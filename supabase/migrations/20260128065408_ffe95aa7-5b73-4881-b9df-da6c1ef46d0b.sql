-- First drop the triggers that depend on line_total
DROP TRIGGER IF EXISTS update_quote_totals_on_item_change ON public.quote_items;
DROP TRIGGER IF EXISTS trigger_increment_quote_version_on_items_update ON public.quote_items;

-- Now drop and recreate the line_total column with correct formula (ex-GST)
ALTER TABLE public.quote_items DROP COLUMN line_total;

ALTER TABLE public.quote_items 
ADD COLUMN line_total numeric GENERATED ALWAYS AS (quantity * unit_price) STORED;

-- Recreate the triggers for quote totals update
CREATE TRIGGER update_quote_totals_on_item_change
AFTER INSERT OR UPDATE OR DELETE ON public.quote_items
FOR EACH ROW
EXECUTE FUNCTION public.update_quote_totals();

-- Recreate the trigger for version increment
CREATE TRIGGER trigger_increment_quote_version_on_items_update
AFTER INSERT OR UPDATE OR DELETE ON public.quote_items
FOR EACH ROW
EXECUTE FUNCTION public.increment_quote_version_on_items();

-- Recalculate all quote totals
UPDATE public.quotes q
SET 
  subtotal = totals.subtotal,
  tax_total = totals.tax_total,
  total_estimate = totals.subtotal + totals.tax_total,
  updated_at = now()
FROM (
  SELECT 
    quote_id,
    COALESCE(SUM(quantity * unit_price), 0) as subtotal,
    COALESCE(SUM(quantity * unit_price * COALESCE(tax_rate, 0.1)), 0) as tax_total
  FROM public.quote_items
  GROUP BY quote_id
) as totals
WHERE q.id = totals.quote_id;