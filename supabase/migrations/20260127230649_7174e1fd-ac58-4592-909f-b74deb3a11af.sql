-- Fix remaining "tuple already modified" error by removing cross-table UPDATE from BEFORE trigger
-- and performing the snapshot in a dedicated AFTER UPDATE trigger.

-- 1) Update BEFORE trigger function: only mutate NEW.* (safe)
CREATE OR REPLACE FUNCTION public.lock_quote_on_acceptance()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  -- When quote status changes to accepted, lock it
  IF NEW.status = 'accepted' AND (OLD.status IS NULL OR OLD.status != 'accepted') THEN
    NEW.is_locked := true;
    NEW.locked_at := NOW();
    -- NOTE: Snapshot moved to AFTER trigger to avoid tuple/trigger conflicts
  END IF;

  RETURN NEW;
END;
$$;

-- 2) New AFTER trigger function: snapshot all line items (no writes back to quotes)
CREATE OR REPLACE FUNCTION public.snapshot_quote_items_on_acceptance()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  -- Only when transitioning to accepted
  IF NEW.status = 'accepted' AND (OLD.status IS NULL OR OLD.status != 'accepted') THEN
    UPDATE public.quote_items
    SET locked_snapshot = jsonb_build_object(
      'description', description,
      'quantity', quantity,
      'unit_price', unit_price,
      'tax_rate', tax_rate,
      'line_total', line_total,
      'discount_amount', discount_amount,
      'discount_percent', discount_percent
    )
    WHERE quote_id = NEW.id;
  END IF;

  RETURN NEW;
END;
$$;

-- 3) Attach AFTER UPDATE trigger (fires only when status is set)
DROP TRIGGER IF EXISTS trigger_snapshot_quote_items_on_acceptance ON public.quotes;

CREATE TRIGGER trigger_snapshot_quote_items_on_acceptance
AFTER UPDATE OF status ON public.quotes
FOR EACH ROW
WHEN (NEW.status = 'accepted' AND (OLD.status IS DISTINCT FROM 'accepted'))
EXECUTE FUNCTION public.snapshot_quote_items_on_acceptance();
