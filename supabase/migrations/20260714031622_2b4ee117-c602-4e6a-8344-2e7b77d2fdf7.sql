CREATE OR REPLACE FUNCTION public.validate_quote_scope()
RETURNS TRIGGER
LANGUAGE plpgsql
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
    -- event scope: allow attaching to a lead before an event exists
    IF NEW.event_id IS NULL AND NEW.lead_id IS NULL THEN
      RAISE EXCEPTION 'Event-scoped quote requires event_id or lead_id';
    END IF;
    NEW.event_series_id := NULL;
    NEW.parent_quote_id := NULL;
  END IF;
  RETURN NEW;
END;
$$;