-- Update the update_quote_totals function to account for quote-level discounts
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
  v_discounted_subtotal NUMERIC;
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
  
  -- Get quote-level discounts
  SELECT 
    COALESCE(discount_percent, 0),
    COALESCE(discount_amount, 0)
  INTO v_discount_percent, v_discount_amount
  FROM quotes
  WHERE id = v_quote_id;
  
  -- Calculate discounted subtotal
  v_discounted_subtotal := v_subtotal;
  
  -- Apply percentage discount first
  IF v_discount_percent > 0 THEN
    v_discounted_subtotal := v_subtotal * (1 - v_discount_percent / 100);
    v_tax_total := v_tax_total * (1 - v_discount_percent / 100);
  END IF;
  
  -- Apply fixed amount discount
  IF v_discount_amount > 0 THEN
    -- Proportionally reduce tax as well
    IF v_discounted_subtotal > 0 THEN
      v_tax_total := v_tax_total * GREATEST(0, (v_discounted_subtotal - v_discount_amount) / v_discounted_subtotal);
    END IF;
    v_discounted_subtotal := GREATEST(0, v_discounted_subtotal - v_discount_amount);
  END IF;
  
  -- Update the quote (keep subtotal as pre-discount, calculate total with discounts)
  UPDATE quotes
  SET 
    subtotal = v_subtotal,
    tax_total = v_tax_total,
    total_estimate = v_discounted_subtotal + v_tax_total,
    updated_at = now()
  WHERE id = v_quote_id;
  
  RETURN COALESCE(NEW, OLD);
END;
$function$;

-- Also create a trigger to recalculate totals when discount fields change on quote
CREATE OR REPLACE FUNCTION public.recalculate_quote_totals_on_discount()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_subtotal NUMERIC;
  v_tax_total NUMERIC;
  v_discounted_subtotal NUMERIC;
BEGIN
  -- Only recalculate if discount fields changed
  IF OLD.discount_percent IS DISTINCT FROM NEW.discount_percent 
     OR OLD.discount_amount IS DISTINCT FROM NEW.discount_amount THEN
    
    -- Calculate totals from all items
    SELECT 
      COALESCE(SUM(line_total), 0),
      COALESCE(SUM(line_total * tax_rate), 0)
    INTO v_subtotal, v_tax_total
    FROM quote_items
    WHERE quote_id = NEW.id;
    
    -- Calculate discounted subtotal
    v_discounted_subtotal := v_subtotal;
    
    -- Apply percentage discount first
    IF NEW.discount_percent > 0 THEN
      v_discounted_subtotal := v_subtotal * (1 - NEW.discount_percent / 100);
      v_tax_total := v_tax_total * (1 - NEW.discount_percent / 100);
    END IF;
    
    -- Apply fixed amount discount
    IF NEW.discount_amount > 0 THEN
      -- Proportionally reduce tax as well
      IF v_discounted_subtotal > 0 THEN
        v_tax_total := v_tax_total * GREATEST(0, (v_discounted_subtotal - NEW.discount_amount) / v_discounted_subtotal);
      END IF;
      v_discounted_subtotal := GREATEST(0, v_discounted_subtotal - NEW.discount_amount);
    END IF;
    
    -- Set new values directly on NEW (we're in a BEFORE trigger)
    NEW.subtotal := v_subtotal;
    NEW.tax_total := v_tax_total;
    NEW.total_estimate := v_discounted_subtotal + v_tax_total;
  END IF;
  
  RETURN NEW;
END;
$function$;

-- Create the trigger if it doesn't exist
DROP TRIGGER IF EXISTS recalculate_quote_totals_on_discount_trigger ON quotes;
CREATE TRIGGER recalculate_quote_totals_on_discount_trigger
  BEFORE UPDATE ON quotes
  FOR EACH ROW
  EXECUTE FUNCTION recalculate_quote_totals_on_discount();