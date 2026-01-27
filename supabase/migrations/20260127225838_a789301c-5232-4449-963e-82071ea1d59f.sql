
-- Fix: Prevent "tuple to be updated was already modified" during quote acceptance
-- Root cause: accepting a quote updates quote_items.locked_snapshot in a BEFORE UPDATE trigger on quotes;
-- quote_items had triggers that updated the parent quotes row (totals/version) on ANY UPDATE (including locked_snapshot),
-- and there were duplicate totals triggers.
--
-- Solution:
-- 1) Remove duplicate totals triggers
-- 2) Recreate triggers to fire only when relevant columns change (exclude locked_snapshot)

-- ==============================
-- Totals trigger (dedupe + narrow)
-- ==============================
DROP TRIGGER IF EXISTS update_quote_totals_trigger ON public.quote_items;
DROP TRIGGER IF EXISTS update_quote_totals_on_item_change ON public.quote_items;

CREATE TRIGGER update_quote_totals_on_item_change
AFTER INSERT OR DELETE OR UPDATE OF
  description,
  quantity,
  unit_price,
  tax_rate,
  discount_percent,
  discount_amount,
  line_total,
  sort_order,
  group_label,
  product_id,
  is_package_item,
  package_source_id
ON public.quote_items
FOR EACH ROW
EXECUTE FUNCTION public.update_quote_totals();

-- =========================================
-- Quote version trigger (narrow on UPDATE)
-- =========================================
DROP TRIGGER IF EXISTS trigger_increment_quote_version_on_items_update ON public.quote_items;

CREATE TRIGGER trigger_increment_quote_version_on_items_update
AFTER UPDATE OF
  description,
  quantity,
  unit_price,
  tax_rate,
  discount_percent,
  discount_amount,
  line_total,
  sort_order,
  group_label,
  product_id,
  is_package_item,
  package_source_id
ON public.quote_items
FOR EACH ROW
EXECUTE FUNCTION public.increment_quote_version_on_items();

-- =========================================
-- Line total trigger (exclude locked_snapshot)
-- =========================================
DROP TRIGGER IF EXISTS calculate_line_total_trigger ON public.quote_items;

CREATE TRIGGER calculate_line_total_trigger
BEFORE INSERT OR UPDATE OF
  quantity,
  unit_price,
  discount_percent,
  discount_amount
ON public.quote_items
FOR EACH ROW
EXECUTE FUNCTION public.calculate_line_total();
