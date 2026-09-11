CREATE OR REPLACE FUNCTION public.contact_status_priority(p_status text)
RETURNS integer
LANGUAGE sql
IMMUTABLE
SET search_path = public
AS $$
  SELECT CASE p_status
    WHEN 'Active' THEN 7
    WHEN 'Current' THEN 6
    WHEN 'Previous' THEN 5
    WHEN 'Old' THEN 4
    WHEN 'Prospect' THEN 3
    WHEN 'Staff' THEN 2
    WHEN 'Archived' THEN 1
    WHEN 'Left Company' THEN 1
    ELSE 0
  END;
$$;

CREATE OR REPLACE FUNCTION public.apply_inherited_status_to_contact(p_contact_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  current_status text;
  inherited text;
  has_active boolean;
  v_bounced text;
BEGIN
  SELECT status, bounce_status INTO current_status, v_bounced FROM client_contacts WHERE id = p_contact_id;

  IF NOT FOUND THEN
    RETURN;
  END IF;

  IF current_status = 'Left Company' THEN
    RETURN;
  END IF;

  IF v_bounced = 'bounced' THEN
    UPDATE client_contacts SET status = 'Archived'
     WHERE id = p_contact_id AND status IS DISTINCT FROM 'Archived';
    RETURN;
  END IF;

  has_active := public.contact_has_open_lead_or_active_event(p_contact_id);

  IF has_active THEN
    UPDATE client_contacts
    SET status = 'Active'
    WHERE id = p_contact_id
      AND status IS DISTINCT FROM 'Active';
    RETURN;
  END IF;

  inherited := public.compute_inherited_contact_status(p_contact_id);

  IF inherited = 'Active' THEN
    inherited := 'Current';
  END IF;

  IF inherited IS NULL THEN
    IF current_status = 'Active' THEN
      UPDATE client_contacts
      SET status = NULL
      WHERE id = p_contact_id
        AND status IS DISTINCT FROM NULL;
    END IF;
    RETURN;
  END IF;

  UPDATE client_contacts
  SET status = inherited
  WHERE id = p_contact_id
    AND status IS DISTINCT FROM inherited;
END;
$$;

CREATE OR REPLACE FUNCTION public.refresh_contact_status(p_contact_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_current_status text;
  v_bounced text;
  v_has_active boolean := false;
  v_last_event_date date;
  v_new_status text;
BEGIN
  IF p_contact_id IS NULL THEN RETURN; END IF;
  SELECT status, bounce_status INTO v_current_status, v_bounced FROM client_contacts WHERE id = p_contact_id;
  IF v_bounced = 'bounced' THEN RETURN; END IF;
  IF v_current_status IS NULL THEN v_current_status := ''; END IF;
  IF v_current_status IN ('Archived','Old','Staff','Left Company') THEN RETURN; END IF;

  SELECT EXISTS (
    SELECT 1 FROM enquiry_contacts ec
    JOIN leads l ON l.id = ec.lead_id
    WHERE ec.contact_id = p_contact_id
      AND COALESCE(l.status,'') NOT IN ('won','lost','Won','Lost')
  ) INTO v_has_active;

  IF NOT v_has_active THEN
    SELECT EXISTS (
      SELECT 1 FROM contact_company_associations cca
      JOIN leads l ON l.client_id = cca.company_id
      WHERE cca.contact_id = p_contact_id
        AND COALESCE(l.status,'') NOT IN ('won','lost','Won','Lost')
    ) INTO v_has_active;
  END IF;

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
END;
$$;

CREATE OR REPLACE FUNCTION public.mark_contact_left_company(p_contact_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  PERFORM set_config('app.manual_contact_status', 'on', true);

  UPDATE public.contact_company_associations
     SET is_active = false
   WHERE contact_id = p_contact_id
     AND is_active IS DISTINCT FROM false;

  UPDATE public.client_contacts
     SET status = 'Left Company',
         archived = true,
         archived_at = coalesce(archived_at, now()),
         is_primary = false,
         client_id = NULL
   WHERE id = p_contact_id;

  PERFORM set_config('app.manual_contact_status', 'off', true);
END;
$$;

GRANT EXECUTE ON FUNCTION public.mark_contact_left_company(uuid) TO authenticated;