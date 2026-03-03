
-- Add discount_groups column to quotes (null = all groups, array = only listed groups)
ALTER TABLE public.quotes ADD COLUMN IF NOT EXISTS discount_groups text[] DEFAULT NULL;

-- Update the trigger function to calculate discounts per-group
CREATE OR REPLACE FUNCTION public.update_quote_totals()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_quote_id UUID;
  v_subtotal NUMERIC;
  v_tax_total NUMERIC;
  v_discount_percent NUMERIC;
  v_discount_amount NUMERIC;
  v_discount_groups text[];
  v_discountable_subtotal NUMERIC;
  v_discountable_tax NUMERIC;
  v_non_discountable_subtotal NUMERIC;
  v_non_discountable_tax NUMERIC;
  v_discount_value NUMERIC;
BEGIN
  v_quote_id := COALESCE(NEW.quote_id, OLD.quote_id);
  
  -- Get quote-level discount settings
  SELECT 
    COALESCE(discount_percent, 0),
    COALESCE(discount_amount, 0),
    discount_groups
  INTO v_discount_percent, v_discount_amount, v_discount_groups
  FROM quotes
  WHERE id = v_quote_id;
  
  -- Calculate full subtotal and tax
  SELECT 
    COALESCE(SUM(line_total), 0),
    COALESCE(SUM(line_total * tax_rate), 0)
  INTO v_subtotal, v_tax_total
  FROM quote_items
  WHERE quote_id = v_quote_id;
  
  -- If discount_groups is set, split into discountable vs non-discountable
  IF v_discount_groups IS NOT NULL AND array_length(v_discount_groups, 1) > 0 THEN
    SELECT 
      COALESCE(SUM(line_total), 0),
      COALESCE(SUM(line_total * tax_rate), 0)
    INTO v_discountable_subtotal, v_discountable_tax
    FROM quote_items
    WHERE quote_id = v_quote_id
      AND COALESCE(group_label, 'Other') = ANY(v_discount_groups);
    
    v_non_discountable_subtotal := v_subtotal - v_discountable_subtotal;
    v_non_discountable_tax := v_tax_total - v_discountable_tax;
  ELSE
    -- No group filter: all items are discountable
    v_discountable_subtotal := v_subtotal;
    v_discountable_tax := v_tax_total;
    v_non_discountable_subtotal := 0;
    v_non_discountable_tax := 0;
  END IF;
  
  -- Apply percentage discount to discountable portion
  IF v_discount_percent > 0 THEN
    v_discount_value := v_discountable_subtotal * (v_discount_percent / 100);
    v_discountable_subtotal := v_discountable_subtotal - v_discount_value;
    v_discountable_tax := v_discountable_tax * (1 - v_discount_percent / 100);
  END IF;
  
  -- Apply fixed amount discount to discountable portion
  IF v_discount_amount > 0 THEN
    IF v_discountable_subtotal > 0 THEN
      v_discountable_tax := v_discountable_tax * GREATEST(0, (v_discountable_subtotal - v_discount_amount) / v_discountable_subtotal);
    END IF;
    v_discountable_subtotal := GREATEST(0, v_discountable_subtotal - v_discount_amount);
  END IF;
  
  -- Final totals = discounted portion + non-discountable portion
  UPDATE quotes
  SET 
    subtotal = v_subtotal,
    tax_total = v_discountable_tax + v_non_discountable_tax,
    total_estimate = v_discountable_subtotal + v_non_discountable_subtotal + v_discountable_tax + v_non_discountable_tax,
    updated_at = now()
  WHERE id = v_quote_id;
  
  RETURN COALESCE(NEW, OLD);
END;
$function$;

-- Also update the BEFORE trigger on quotes for discount changes
CREATE OR REPLACE FUNCTION public.recalculate_quote_totals_on_discount()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_subtotal NUMERIC;
  v_tax_total NUMERIC;
  v_discountable_subtotal NUMERIC;
  v_discountable_tax NUMERIC;
  v_non_discountable_subtotal NUMERIC;
  v_non_discountable_tax NUMERIC;
  v_discount_value NUMERIC;
BEGIN
  -- Only recalculate if discount fields changed
  IF OLD.discount_percent IS DISTINCT FROM NEW.discount_percent 
     OR OLD.discount_amount IS DISTINCT FROM NEW.discount_amount
     OR OLD.discount_groups IS DISTINCT FROM NEW.discount_groups THEN
    
    -- Calculate totals from all items
    SELECT 
      COALESCE(SUM(line_total), 0),
      COALESCE(SUM(line_total * tax_rate), 0)
    INTO v_subtotal, v_tax_total
    FROM quote_items
    WHERE quote_id = NEW.id;
    
    -- Split by discount groups
    IF NEW.discount_groups IS NOT NULL AND array_length(NEW.discount_groups, 1) > 0 THEN
      SELECT 
        COALESCE(SUM(line_total), 0),
        COALESCE(SUM(line_total * tax_rate), 0)
      INTO v_discountable_subtotal, v_discountable_tax
      FROM quote_items
      WHERE quote_id = NEW.id
        AND COALESCE(group_label, 'Other') = ANY(NEW.discount_groups);
      
      v_non_discountable_subtotal := v_subtotal - v_discountable_subtotal;
      v_non_discountable_tax := v_tax_total - v_discountable_tax;
    ELSE
      v_discountable_subtotal := v_subtotal;
      v_discountable_tax := v_tax_total;
      v_non_discountable_subtotal := 0;
      v_non_discountable_tax := 0;
    END IF;
    
    -- Apply percentage discount
    IF NEW.discount_percent > 0 THEN
      v_discount_value := v_discountable_subtotal * (NEW.discount_percent / 100);
      v_discountable_subtotal := v_discountable_subtotal - v_discount_value;
      v_discountable_tax := v_discountable_tax * (1 - NEW.discount_percent / 100);
    END IF;
    
    -- Apply fixed amount discount
    IF NEW.discount_amount > 0 THEN
      IF v_discountable_subtotal > 0 THEN
        v_discountable_tax := v_discountable_tax * GREATEST(0, (v_discountable_subtotal - NEW.discount_amount) / v_discountable_subtotal);
      END IF;
      v_discountable_subtotal := GREATEST(0, v_discountable_subtotal - NEW.discount_amount);
    END IF;
    
    NEW.subtotal := v_subtotal;
    NEW.tax_total := v_discountable_tax + v_non_discountable_tax;
    NEW.total_estimate := v_discountable_subtotal + v_non_discountable_subtotal + v_discountable_tax + v_non_discountable_tax;
  END IF;
  
  RETURN NEW;
END;
$function$;
