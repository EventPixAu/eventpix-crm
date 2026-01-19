-- =====================================================
-- STUDIO NINJA QUOTE BEHAVIOR - DATA MODEL ALIGNMENT
-- =====================================================

-- 1. Add event (job) reference to quotes
ALTER TABLE public.quotes
ADD COLUMN IF NOT EXISTS event_id UUID REFERENCES public.events(id);

-- Create index for job-quote lookups
CREATE INDEX IF NOT EXISTS idx_quotes_event_id ON public.quotes(event_id);

-- 2. Add discount fields to quote_items for offsets
ALTER TABLE public.quote_items
ADD COLUMN IF NOT EXISTS discount_percent NUMERIC(5,2) DEFAULT 0,
ADD COLUMN IF NOT EXISTS discount_amount NUMERIC(10,2) DEFAULT 0,
ADD COLUMN IF NOT EXISTS is_package_item BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS package_source_id UUID REFERENCES public.products(id);

-- 3. Add is_locked flag to quotes for explicit locking
ALTER TABLE public.quotes
ADD COLUMN IF NOT EXISTS is_locked BOOLEAN DEFAULT false;

-- =====================================================
-- QUOTE ACCEPTANCE FUNCTION
-- Locks quote, updates job status, triggers workflow
-- =====================================================

CREATE OR REPLACE FUNCTION public.accept_quote(
  p_quote_id UUID,
  p_accepted_by_name TEXT DEFAULT NULL,
  p_accepted_by_email TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_quote RECORD;
  v_event_id UUID;
  v_workflow_template_id UUID;
BEGIN
  -- Get quote details
  SELECT * INTO v_quote FROM quotes WHERE id = p_quote_id;
  
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Quote not found');
  END IF;
  
  -- Check if already locked/accepted
  IF v_quote.is_locked OR v_quote.status = 'accepted' THEN
    RETURN jsonb_build_object('success', false, 'error', 'Quote is already accepted or locked');
  END IF;
  
  -- Lock and accept the quote
  UPDATE quotes
  SET 
    status = 'accepted',
    quote_status = 'accepted',
    is_locked = true,
    accepted_at = now(),
    accepted_by_name = COALESCE(p_accepted_by_name, accepted_by_name),
    accepted_by_email = COALESCE(p_accepted_by_email, accepted_by_email),
    updated_at = now()
  WHERE id = p_quote_id;
  
  -- Get linked event (job) ID - either from quote.event_id or quote.linked_event_id
  v_event_id := COALESCE(v_quote.event_id, v_quote.linked_event_id);
  
  -- If we have an event, update its status and trigger workflow auto-steps
  IF v_event_id IS NOT NULL THEN
    -- Update event ops status to indicate booking confirmed
    UPDATE events
    SET 
      ops_status = COALESCE(ops_status, 'booked'),
      updated_at = now()
    WHERE id = v_event_id;
    
    -- Get workflow template from event
    SELECT workflow_template_id INTO v_workflow_template_id
    FROM events WHERE id = v_event_id;
    
    -- Auto-complete workflow steps triggered by quote_accepted
    UPDATE event_workflow_steps
    SET 
      is_completed = true,
      completed_at = now(),
      notes = 'Auto-completed: Quote accepted'
    WHERE event_id = v_event_id
      AND auto_trigger_event = 'quote_accepted'
      AND is_completed = false;
  END IF;
  
  RETURN jsonb_build_object(
    'success', true,
    'quote_id', p_quote_id,
    'event_id', v_event_id,
    'accepted_at', now()
  );
END;
$$;

-- =====================================================
-- ADD PACKAGE TO QUOTE FUNCTION
-- Explodes package into individual line items
-- =====================================================

CREATE OR REPLACE FUNCTION public.add_package_to_quote(
  p_quote_id UUID,
  p_package_id UUID,
  p_quantity INTEGER DEFAULT 1
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_package RECORD;
  v_item RECORD;
  v_max_sort INTEGER;
  v_package_total NUMERIC := 0;
  v_items_added INTEGER := 0;
BEGIN
  -- Get package details
  SELECT * INTO v_package FROM products WHERE id = p_package_id AND is_package = true;
  
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Package not found');
  END IF;
  
  -- Get current max sort order
  SELECT COALESCE(MAX(sort_order), 0) INTO v_max_sort FROM quote_items WHERE quote_id = p_quote_id;
  
  -- Add package header line (if package has a price, use it; otherwise sum components)
  IF v_package.unit_price > 0 THEN
    -- Package has fixed price - add as single line with package price
    INSERT INTO quote_items (
      quote_id, product_id, description, quantity, unit_price, tax_rate, 
      sort_order, group_label, is_package_item, package_source_id
    )
    VALUES (
      p_quote_id, p_package_id, v_package.name, p_quantity, v_package.unit_price, 
      COALESCE(v_package.tax_rate, 0.1), v_max_sort + 1, 'Coverage', false, NULL
    );
    v_items_added := 1;
  ELSE
    -- Package is collection - add each item with package reference
    FOR v_item IN 
      SELECT pi.*, p.name, p.unit_price, p.tax_rate, p.description
      FROM package_items pi
      JOIN products p ON p.id = pi.product_id
      WHERE pi.package_id = p_package_id
      ORDER BY pi.sort_order
    LOOP
      v_max_sort := v_max_sort + 1;
      
      INSERT INTO quote_items (
        quote_id, product_id, description, quantity, unit_price, tax_rate,
        sort_order, group_label, is_package_item, package_source_id
      )
      VALUES (
        p_quote_id, v_item.product_id, v_item.name, 
        v_item.quantity * p_quantity, v_item.unit_price, 
        COALESCE(v_item.tax_rate, 0.1), v_max_sort, 'Coverage', 
        true, p_package_id
      );
      
      v_items_added := v_items_added + 1;
    END LOOP;
    
    -- Apply package discount if any
    IF v_package.package_discount_percent > 0 OR v_package.package_discount_amount > 0 THEN
      v_max_sort := v_max_sort + 1;
      
      -- Calculate discount
      SELECT COALESCE(SUM(line_total), 0) INTO v_package_total 
      FROM quote_items 
      WHERE quote_id = p_quote_id AND package_source_id = p_package_id;
      
      INSERT INTO quote_items (
        quote_id, product_id, description, quantity, unit_price, tax_rate,
        sort_order, group_label, is_package_item, package_source_id
      )
      VALUES (
        p_quote_id, NULL, 'Package Discount - ' || v_package.name, 1,
        -1 * GREATEST(
          v_package_total * (v_package.package_discount_percent / 100),
          v_package.package_discount_amount
        ),
        0, v_max_sort, 'Coverage', true, p_package_id
      );
      v_items_added := v_items_added + 1;
    END IF;
  END IF;
  
  RETURN jsonb_build_object(
    'success', true,
    'items_added', v_items_added,
    'package_name', v_package.name
  );
END;
$$;

-- =====================================================
-- UPDATE QUOTE TOTALS TRIGGER
-- Recalculates subtotal, tax, and total on item changes
-- =====================================================

CREATE OR REPLACE FUNCTION public.update_quote_totals()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_quote_id UUID;
  v_subtotal NUMERIC;
  v_tax_total NUMERIC;
BEGIN
  -- Get the quote_id from the affected row
  v_quote_id := COALESCE(NEW.quote_id, OLD.quote_id);
  
  -- Calculate totals from all items
  SELECT 
    COALESCE(SUM(line_total), 0),
    COALESCE(SUM(line_total * tax_rate), 0)
  INTO v_subtotal, v_tax_total
  FROM quote_items
  WHERE quote_id = v_quote_id;
  
  -- Update the quote
  UPDATE quotes
  SET 
    subtotal = v_subtotal,
    tax_total = v_tax_total,
    total_estimate = v_subtotal + v_tax_total,
    updated_at = now()
  WHERE id = v_quote_id;
  
  RETURN COALESCE(NEW, OLD);
END;
$$;

-- Drop existing trigger if exists and recreate
DROP TRIGGER IF EXISTS update_quote_totals_trigger ON quote_items;
CREATE TRIGGER update_quote_totals_trigger
  AFTER INSERT OR UPDATE OR DELETE ON quote_items
  FOR EACH ROW
  EXECUTE FUNCTION public.update_quote_totals();

-- =====================================================
-- LINE TOTAL CALCULATION TRIGGER
-- Auto-calculates line_total including discounts
-- =====================================================

CREATE OR REPLACE FUNCTION public.calculate_line_total()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_base_total NUMERIC;
BEGIN
  -- Calculate base total
  v_base_total := NEW.quantity * NEW.unit_price;
  
  -- Apply discounts
  IF NEW.discount_percent > 0 THEN
    v_base_total := v_base_total * (1 - NEW.discount_percent / 100);
  END IF;
  
  IF NEW.discount_amount > 0 THEN
    v_base_total := v_base_total - NEW.discount_amount;
  END IF;
  
  -- Set line_total (before tax - tax is added in quote totals)
  NEW.line_total := GREATEST(v_base_total, 0);
  
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS calculate_line_total_trigger ON quote_items;
CREATE TRIGGER calculate_line_total_trigger
  BEFORE INSERT OR UPDATE ON quote_items
  FOR EACH ROW
  EXECUTE FUNCTION public.calculate_line_total();