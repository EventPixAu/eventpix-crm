
ALTER TABLE public.contact_activities DROP CONSTRAINT IF EXISTS contact_activities_activity_type_check;
ALTER TABLE public.contact_activities ADD CONSTRAINT contact_activities_activity_type_check
  CHECK (activity_type = ANY (ARRAY['email','phone_call','meeting','status_change','category_change','note','task','system']));

CREATE OR REPLACE FUNCTION public.refresh_contact_status(p_contact_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_current_status text;
  v_has_active boolean := false;
  v_last_event_date date;
  v_new_status text;
BEGIN
  IF p_contact_id IS NULL THEN RETURN; END IF;
  SELECT status INTO v_current_status FROM client_contacts WHERE id = p_contact_id;
  IF v_current_status IS NULL THEN v_current_status := ''; END IF;
  IF v_current_status IN ('Archived','Old') THEN RETURN; END IF;

  SELECT EXISTS (
    SELECT 1 FROM contact_company_associations cca
    JOIN leads l ON l.client_id = cca.company_id
    WHERE cca.contact_id = p_contact_id
      AND COALESCE(l.status,'') NOT IN ('won','lost','Won','Lost')
  ) INTO v_has_active;

  IF NOT v_has_active THEN
    SELECT EXISTS (
      SELECT 1 FROM contact_company_associations cca
      JOIN events e ON e.client_id = cca.company_id
      WHERE cca.contact_id = p_contact_id
        AND COALESCE(e.ops_status,'') NOT IN ('completed','delivered','archived','cancelled')
    ) INTO v_has_active;
  END IF;

  IF NOT v_has_active THEN
    SELECT EXISTS (
      SELECT 1 FROM event_contacts ec
      JOIN events e ON e.id = ec.event_id
      WHERE ec.client_contact_id = p_contact_id
        AND COALESCE(e.ops_status,'') NOT IN ('completed','delivered','archived','cancelled')
    ) INTO v_has_active;
  END IF;

  IF v_has_active THEN
    v_new_status := 'Active';
  ELSE
    IF v_current_status <> 'Active' THEN RETURN; END IF;
    SELECT GREATEST(
      (SELECT MAX(e.event_date) FROM contact_company_associations cca
        JOIN events e ON e.client_id = cca.company_id WHERE cca.contact_id = p_contact_id),
      (SELECT MAX(e.event_date) FROM event_contacts ec
        JOIN events e ON e.id = ec.event_id WHERE ec.client_contact_id = p_contact_id)
    ) INTO v_last_event_date;
    IF v_last_event_date IS NOT NULL AND v_last_event_date >= (CURRENT_DATE - INTERVAL '12 months') THEN
      v_new_status := 'Current';
    ELSE
      v_new_status := 'Previous';
    END IF;
  END IF;

  IF v_new_status IS DISTINCT FROM v_current_status THEN
    UPDATE client_contacts SET status = v_new_status WHERE id = p_contact_id;
  END IF;
END;$$;

CREATE OR REPLACE FUNCTION public.refresh_contacts_for_company(p_company_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE r record;
BEGIN
  IF p_company_id IS NULL THEN RETURN; END IF;
  FOR r IN SELECT contact_id FROM contact_company_associations WHERE company_id = p_company_id LOOP
    PERFORM public.refresh_contact_status(r.contact_id);
  END LOOP;
END;$$;

CREATE OR REPLACE FUNCTION public.trg_lead_refresh_contact_status()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN PERFORM public.refresh_contacts_for_company(OLD.client_id); RETURN OLD; END IF;
  PERFORM public.refresh_contacts_for_company(NEW.client_id);
  IF TG_OP = 'UPDATE' AND OLD.client_id IS DISTINCT FROM NEW.client_id THEN
    PERFORM public.refresh_contacts_for_company(OLD.client_id);
  END IF;
  RETURN NEW;
END;$$;
DROP TRIGGER IF EXISTS leads_refresh_contact_status ON public.leads;
CREATE TRIGGER leads_refresh_contact_status
AFTER INSERT OR UPDATE OF status, client_id OR DELETE ON public.leads
FOR EACH ROW EXECUTE FUNCTION public.trg_lead_refresh_contact_status();

CREATE OR REPLACE FUNCTION public.trg_event_refresh_contact_status()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE r record;
BEGIN
  IF TG_OP = 'DELETE' THEN
    PERFORM public.refresh_contacts_for_company(OLD.client_id);
    FOR r IN SELECT client_contact_id FROM event_contacts WHERE event_id = OLD.id LOOP
      PERFORM public.refresh_contact_status(r.client_contact_id);
    END LOOP;
    RETURN OLD;
  END IF;
  PERFORM public.refresh_contacts_for_company(NEW.client_id);
  IF TG_OP = 'UPDATE' AND OLD.client_id IS DISTINCT FROM NEW.client_id THEN
    PERFORM public.refresh_contacts_for_company(OLD.client_id);
  END IF;
  FOR r IN SELECT client_contact_id FROM event_contacts WHERE event_id = NEW.id LOOP
    PERFORM public.refresh_contact_status(r.client_contact_id);
  END LOOP;
  RETURN NEW;
END;$$;
DROP TRIGGER IF EXISTS events_refresh_contact_status ON public.events;
CREATE TRIGGER events_refresh_contact_status
AFTER INSERT OR UPDATE OF ops_status, client_id, event_date OR DELETE ON public.events
FOR EACH ROW EXECUTE FUNCTION public.trg_event_refresh_contact_status();

CREATE OR REPLACE FUNCTION public.trg_event_contacts_refresh_status()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN PERFORM public.refresh_contact_status(OLD.client_contact_id); RETURN OLD; END IF;
  PERFORM public.refresh_contact_status(NEW.client_contact_id);
  RETURN NEW;
END;$$;
DROP TRIGGER IF EXISTS event_contacts_refresh_status ON public.event_contacts;
CREATE TRIGGER event_contacts_refresh_status
AFTER INSERT OR UPDATE OR DELETE ON public.event_contacts
FOR EACH ROW EXECUTE FUNCTION public.trg_event_contacts_refresh_status();

CREATE OR REPLACE FUNCTION public.trg_cca_refresh_status()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN PERFORM public.refresh_contact_status(OLD.contact_id); RETURN OLD; END IF;
  PERFORM public.refresh_contact_status(NEW.contact_id);
  RETURN NEW;
END;$$;
DROP TRIGGER IF EXISTS cca_refresh_status ON public.contact_company_associations;
CREATE TRIGGER cca_refresh_status
AFTER INSERT OR UPDATE OR DELETE ON public.contact_company_associations
FOR EACH ROW EXECUTE FUNCTION public.trg_cca_refresh_status();

DO $$
DECLARE r record;
BEGIN
  FOR r IN SELECT id FROM client_contacts LOOP
    PERFORM public.refresh_contact_status(r.id);
  END LOOP;
END;$$;
