CREATE OR REPLACE FUNCTION public.clear_tba_lead_date_fields()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF NEW.status = 'on_hold_date_tba' AND OLD.status IS DISTINCT FROM NEW.status THEN
    NEW.estimated_event_date := NULL;
    NEW.main_shoot_start_at := NULL;
    NEW.main_shoot_end_at := NULL;
    NEW.event_month_hint := NULL;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER clear_tba_lead_date_fields
BEFORE UPDATE OF status ON public.leads
FOR EACH ROW EXECUTE FUNCTION public.clear_tba_lead_date_fields();

CREATE OR REPLACE FUNCTION public.clear_tba_lead_sessions()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.status = 'on_hold_date_tba' AND OLD.status IS DISTINCT FROM NEW.status THEN
    DELETE FROM public.event_sessions WHERE lead_id = NEW.id AND event_id IS NULL;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER clear_tba_lead_sessions
AFTER UPDATE OF status ON public.leads
FOR EACH ROW EXECUTE FUNCTION public.clear_tba_lead_sessions();