-- ============================================================
-- Quote UX Upgrade: Schema Changes
-- ============================================================

-- 1) Add new fields to quotes table
ALTER TABLE public.quotes
ADD COLUMN IF NOT EXISTS intro_text text,
ADD COLUMN IF NOT EXISTS scope_text text,
ADD COLUMN IF NOT EXISTS notes_internal text,
ADD COLUMN IF NOT EXISTS quote_version integer NOT NULL DEFAULT 1;

-- 2) Add group_label to quote_items for grouping line items
ALTER TABLE public.quote_items
ADD COLUMN IF NOT EXISTS group_label text;

-- 3) Create trigger function to increment quote_version when status = 'sent' and edits occur
CREATE OR REPLACE FUNCTION public.increment_quote_version()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Only increment version if quote is already sent and key fields changed
  IF OLD.status = 'sent' AND (
    OLD.intro_text IS DISTINCT FROM NEW.intro_text OR
    OLD.scope_text IS DISTINCT FROM NEW.scope_text OR
    OLD.terms_text IS DISTINCT FROM NEW.terms_text OR
    OLD.valid_until IS DISTINCT FROM NEW.valid_until
  ) THEN
    NEW.quote_version := OLD.quote_version + 1;
  END IF;
  RETURN NEW;
END;
$$;

-- 4) Create trigger on quotes table
DROP TRIGGER IF EXISTS trigger_increment_quote_version ON public.quotes;
CREATE TRIGGER trigger_increment_quote_version
  BEFORE UPDATE ON public.quotes
  FOR EACH ROW
  EXECUTE FUNCTION public.increment_quote_version();

-- 5) Create trigger function to increment quote_version when quote_items change for a sent quote
CREATE OR REPLACE FUNCTION public.increment_quote_version_on_items()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_quote_status text;
BEGIN
  -- Get the quote status
  SELECT status INTO v_quote_status
  FROM public.quotes
  WHERE id = COALESCE(NEW.quote_id, OLD.quote_id);
  
  -- Only increment if quote is already sent
  IF v_quote_status = 'sent' THEN
    UPDATE public.quotes
    SET quote_version = quote_version + 1,
        updated_at = now()
    WHERE id = COALESCE(NEW.quote_id, OLD.quote_id);
  END IF;
  
  RETURN COALESCE(NEW, OLD);
END;
$$;

-- 6) Create triggers on quote_items table for insert, update, delete
DROP TRIGGER IF EXISTS trigger_increment_quote_version_on_items_insert ON public.quote_items;
DROP TRIGGER IF EXISTS trigger_increment_quote_version_on_items_update ON public.quote_items;
DROP TRIGGER IF EXISTS trigger_increment_quote_version_on_items_delete ON public.quote_items;

CREATE TRIGGER trigger_increment_quote_version_on_items_insert
  AFTER INSERT ON public.quote_items
  FOR EACH ROW
  EXECUTE FUNCTION public.increment_quote_version_on_items();

CREATE TRIGGER trigger_increment_quote_version_on_items_update
  AFTER UPDATE ON public.quote_items
  FOR EACH ROW
  EXECUTE FUNCTION public.increment_quote_version_on_items();

CREATE TRIGGER trigger_increment_quote_version_on_items_delete
  AFTER DELETE ON public.quote_items
  FOR EACH ROW
  EXECUTE FUNCTION public.increment_quote_version_on_items();

-- 7) Add comment for clarity on internal notes security
COMMENT ON COLUMN public.quotes.notes_internal IS 'Internal notes for Admin/Sales only - NEVER expose on public routes';