
-- Extend refresh_contact_status to:
-- 1) Protect 'Staff' contacts from auto-changes
-- 2) Also check enquiry_contacts (lead<->contact direct link) for active leads
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
  -- Never modify Staff, Archived, or Old contacts (manual states)
  IF v_current_status IN ('Archived','Old','Staff') THEN RETURN; END IF;

  -- Direct lead<->contact link via enquiry_contacts
  SELECT EXISTS (
    SELECT 1 FROM enquiry_contacts ec
    JOIN leads l ON l.id = ec.lead_id
    WHERE ec.contact_id = p_contact_id
      AND COALESCE(l.status,'') NOT IN ('won','lost','Won','Lost')
  ) INTO v_has_active;

  -- Lead linked via the contact's company
  IF NOT v_has_active THEN
    SELECT EXISTS (
      SELECT 1 FROM contact_company_associations cca
      JOIN leads l ON l.client_id = cca.company_id
      WHERE cca.contact_id = p_contact_id
        AND COALESCE(l.status,'') NOT IN ('won','lost','Won','Lost')
    ) INTO v_has_active;
  END IF;

  -- Active event via the contact's company
  IF NOT v_has_active THEN
    SELECT EXISTS (
      SELECT 1 FROM contact_company_associations cca
      JOIN events e ON e.client_id = cca.company_id
      WHERE cca.contact_id = p_contact_id
        AND COALESCE(e.ops_status,'') NOT IN ('completed','delivered','archived','cancelled')
    ) INTO v_has_active;
  END IF;

  -- Direct event<->contact link
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

-- Trigger on enquiry_contacts (lead<->contact direct linkage)
CREATE OR REPLACE FUNCTION public.trg_enquiry_contacts_refresh_status()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    IF OLD.contact_id IS NOT NULL THEN PERFORM public.refresh_contact_status(OLD.contact_id); END IF;
    RETURN OLD;
  END IF;
  IF NEW.contact_id IS NOT NULL THEN PERFORM public.refresh_contact_status(NEW.contact_id); END IF;
  IF TG_OP = 'UPDATE' AND OLD.contact_id IS DISTINCT FROM NEW.contact_id AND OLD.contact_id IS NOT NULL THEN
    PERFORM public.refresh_contact_status(OLD.contact_id);
  END IF;
  RETURN NEW;
END;$$;
DROP TRIGGER IF EXISTS enquiry_contacts_refresh_status ON public.enquiry_contacts;
CREATE TRIGGER enquiry_contacts_refresh_status
AFTER INSERT OR UPDATE OR DELETE ON public.enquiry_contacts
FOR EACH ROW EXECUTE FUNCTION public.trg_enquiry_contacts_refresh_status();

-- Extend lead trigger so direct enquiry_contacts links are also refreshed when a lead status/client changes
CREATE OR REPLACE FUNCTION public.trg_lead_refresh_contact_status()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE r record;
BEGIN
  IF TG_OP = 'DELETE' THEN
    PERFORM public.refresh_contacts_for_company(OLD.client_id);
    FOR r IN SELECT contact_id FROM enquiry_contacts WHERE lead_id = OLD.id AND contact_id IS NOT NULL LOOP
      PERFORM public.refresh_contact_status(r.contact_id);
    END LOOP;
    RETURN OLD;
  END IF;
  PERFORM public.refresh_contacts_for_company(NEW.client_id);
  IF TG_OP = 'UPDATE' AND OLD.client_id IS DISTINCT FROM NEW.client_id THEN
    PERFORM public.refresh_contacts_for_company(OLD.client_id);
  END IF;
  FOR r IN SELECT contact_id FROM enquiry_contacts WHERE lead_id = NEW.id AND contact_id IS NOT NULL LOOP
    PERFORM public.refresh_contact_status(r.contact_id);
  END LOOP;
  RETURN NEW;
END;$$;

-- Backfill: re-run refresh on every contact
DO $$
DECLARE r record;
BEGIN
  FOR r IN SELECT id FROM client_contacts LOOP
    PERFORM public.refresh_contact_status(r.id);
  END LOOP;
END;$$;
