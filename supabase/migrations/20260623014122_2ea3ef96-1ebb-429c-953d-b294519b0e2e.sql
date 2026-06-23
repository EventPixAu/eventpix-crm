
-- Remap company→contact status so company status NEVER yields 'Active'.
-- 'Active' is reserved for contacts with an open lead or active event,
-- assigned by lead/event automation only.
CREATE OR REPLACE FUNCTION public.map_company_status_to_contact_status(p_company_status text)
RETURNS text
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT CASE lower(coalesce(p_company_status, ''))
    WHEN 'active' THEN 'Current'
    WHEN 'active_event' THEN 'Current'
    WHEN 'current' THEN 'Current'
    WHEN 'current_client' THEN 'Current'
    WHEN 'previous_client' THEN 'Previous'
    WHEN 'previous' THEN 'Previous'
    WHEN 'inactive' THEN 'Old'
    WHEN 'x_inactive' THEN 'Old'
    WHEN 'lost' THEN 'Old'
    WHEN 'old' THEN 'Old'
    WHEN 'prospect' THEN 'Prospect'
    WHEN 'archived' THEN 'Archived'
    WHEN 'staff' THEN 'Staff'
    ELSE NULL
  END;
$$;

-- Helper: does this contact have an open lead or active event?
CREATE OR REPLACE FUNCTION public.contact_has_open_lead_or_active_event(p_contact_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM enquiry_contacts ec
    JOIN leads l ON l.id = ec.lead_id
    WHERE ec.contact_id = p_contact_id
      AND lower(coalesce(l.status,'')) NOT IN ('lost','won')
  ) OR EXISTS (
    SELECT 1 FROM event_contacts evc
    JOIN events e ON e.id = evc.event_id
    WHERE evc.client_contact_id = p_contact_id
      AND lower(coalesce(e.ops_status,'')) NOT IN ('completed','delivered')
  );
$$;

-- Replace apply_inherited_status_to_contact:
--  * inheritance never sets 'Active' (mapping already prevents it, but guard anyway)
--  * if contact is currently 'Active' but no open lead/active event, demote
--    to inherited company status.
CREATE OR REPLACE FUNCTION public.apply_inherited_status_to_contact(p_contact_id uuid)
RETURNS void
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  current_status text;
  inherited text;
  has_active boolean;
BEGIN
  SELECT status INTO current_status FROM client_contacts WHERE id = p_contact_id;
  inherited := public.compute_inherited_contact_status(p_contact_id);

  -- Defensive: inheritance must never produce 'Active'
  IF inherited = 'Active' THEN inherited := 'Current'; END IF;

  -- If contact is 'Active' but has no qualifying lead/event, demote
  IF current_status = 'Active' THEN
    has_active := public.contact_has_open_lead_or_active_event(p_contact_id);
    IF NOT has_active THEN
      UPDATE client_contacts
      SET status = inherited
      WHERE id = p_contact_id
        AND (status IS DISTINCT FROM inherited);
      RETURN;
    ELSE
      RETURN; -- legitimately Active, leave alone
    END IF;
  END IF;

  IF inherited IS NULL THEN RETURN; END IF;

  IF current_status IS NULL
     OR trim(current_status) = ''
     OR public.contact_status_priority(inherited) > public.contact_status_priority(current_status)
  THEN
    UPDATE client_contacts
    SET status = inherited
    WHERE id = p_contact_id
      AND (status IS DISTINCT FROM inherited);
  END IF;
END;
$$;

-- BACKFILL: re-evaluate every contact currently marked 'Active'
DO $$
DECLARE
  cid uuid;
BEGIN
  FOR cid IN SELECT id FROM client_contacts WHERE status = 'Active' LOOP
    PERFORM public.apply_inherited_status_to_contact(cid);
  END LOOP;
END $$;
