
-- QUOTES: allow series/addendum scoping
ALTER TABLE public.quotes
  ADD COLUMN IF NOT EXISTS scope TEXT NOT NULL DEFAULT 'event',
  ADD COLUMN IF NOT EXISTS event_series_id UUID REFERENCES public.event_series(id) ON DELETE CASCADE,
  ADD COLUMN IF NOT EXISTS parent_quote_id UUID REFERENCES public.quotes(id) ON DELETE SET NULL;

ALTER TABLE public.quotes
  ALTER COLUMN event_id DROP NOT NULL;

CREATE INDEX IF NOT EXISTS idx_quotes_event_series_id ON public.quotes(event_series_id);
CREATE INDEX IF NOT EXISTS idx_quotes_parent_quote_id ON public.quotes(parent_quote_id);
CREATE INDEX IF NOT EXISTS idx_quotes_scope ON public.quotes(scope);

-- Validate scope invariants via trigger (avoids immutable CHECK issues)
CREATE OR REPLACE FUNCTION public.validate_quote_scope()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF NEW.scope NOT IN ('event','series','addendum') THEN
    RAISE EXCEPTION 'Invalid quote scope: %', NEW.scope;
  END IF;
  IF NEW.scope = 'series' THEN
    IF NEW.event_series_id IS NULL THEN
      RAISE EXCEPTION 'Series-scoped quote requires event_series_id';
    END IF;
    NEW.event_id := NULL;
    NEW.parent_quote_id := NULL;
  ELSIF NEW.scope = 'addendum' THEN
    IF NEW.event_id IS NULL OR NEW.parent_quote_id IS NULL THEN
      RAISE EXCEPTION 'Addendum quote requires event_id and parent_quote_id';
    END IF;
  ELSE
    -- event scope
    IF NEW.event_id IS NULL THEN
      RAISE EXCEPTION 'Event-scoped quote requires event_id';
    END IF;
    NEW.event_series_id := NULL;
    NEW.parent_quote_id := NULL;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_validate_quote_scope ON public.quotes;
CREATE TRIGGER trg_validate_quote_scope
  BEFORE INSERT OR UPDATE ON public.quotes
  FOR EACH ROW EXECUTE FUNCTION public.validate_quote_scope();

-- QUOTE ITEMS: per-event pricing
ALTER TABLE public.quote_items
  ADD COLUMN IF NOT EXISTS pricing_basis TEXT NOT NULL DEFAULT 'flat',
  ADD COLUMN IF NOT EXISTS event_count INTEGER;

-- CONTRACTS: series scoping
ALTER TABLE public.contracts
  ADD COLUMN IF NOT EXISTS scope TEXT NOT NULL DEFAULT 'event',
  ADD COLUMN IF NOT EXISTS event_series_id UUID REFERENCES public.event_series(id) ON DELETE CASCADE;

ALTER TABLE public.contracts
  ALTER COLUMN event_id DROP NOT NULL;

CREATE INDEX IF NOT EXISTS idx_contracts_event_series_id ON public.contracts(event_series_id);
CREATE INDEX IF NOT EXISTS idx_contracts_scope ON public.contracts(scope);

CREATE OR REPLACE FUNCTION public.validate_contract_scope()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF NEW.scope NOT IN ('event','series') THEN
    RAISE EXCEPTION 'Invalid contract scope: %', NEW.scope;
  END IF;
  IF NEW.scope = 'series' THEN
    IF NEW.event_series_id IS NULL THEN
      RAISE EXCEPTION 'Series-scoped contract requires event_series_id';
    END IF;
    NEW.event_id := NULL;
  ELSE
    IF NEW.event_id IS NULL THEN
      RAISE EXCEPTION 'Event-scoped contract requires event_id';
    END IF;
    NEW.event_series_id := NULL;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_validate_contract_scope ON public.contracts;
CREATE TRIGGER trg_validate_contract_scope
  BEFORE INSERT OR UPDATE ON public.contracts
  FOR EACH ROW EXECUTE FUNCTION public.validate_contract_scope();
