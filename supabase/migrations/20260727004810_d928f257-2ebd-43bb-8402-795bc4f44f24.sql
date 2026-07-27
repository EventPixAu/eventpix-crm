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
    NEW.lead_id := NULL;
  ELSE
    IF NEW.event_id IS NULL AND NEW.lead_id IS NULL THEN
      RAISE EXCEPTION 'Event-scoped contract requires event_id or lead_id';
    END IF;
    NEW.event_series_id := NULL;
  END IF;
  RETURN NEW;
END;
$$;