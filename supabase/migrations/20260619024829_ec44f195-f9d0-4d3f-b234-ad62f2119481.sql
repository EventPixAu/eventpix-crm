
-- Map company status (slug) -> contact status (label)
CREATE OR REPLACE FUNCTION public.map_company_status_to_contact_status(p_company_status text)
RETURNS text
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT CASE lower(coalesce(p_company_status, ''))
    WHEN 'active' THEN 'Active'
    WHEN 'active_event' THEN 'Active'
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

-- Numeric priority for a contact status (higher = higher priority)
CREATE OR REPLACE FUNCTION public.contact_status_priority(p_status text)
RETURNS int
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT CASE p_status
    WHEN 'Active' THEN 7
    WHEN 'Current' THEN 6
    WHEN 'Previous' THEN 5
    WHEN 'Old' THEN 4
    WHEN 'Prospect' THEN 3
    WHEN 'Staff' THEN 2
    WHEN 'Archived' THEN 1
    ELSE 0
  END;
$$;

-- Compute best inherited status for a contact based on all linked companies
-- (both direct client_id and contact_company_associations)
CREATE OR REPLACE FUNCTION public.compute_inherited_contact_status(p_contact_id uuid)
RETURNS text
LANGUAGE plpgsql
STABLE
SET search_path = public
AS $$
DECLARE
  best text := NULL;
  best_pri int := 0;
  rec record;
  mapped text;
  pri int;
BEGIN
  FOR rec IN
    SELECT coalesce(c.manual_status, c.status) AS company_status
    FROM clients c
    WHERE c.id IN (
      SELECT client_id FROM client_contacts WHERE id = p_contact_id AND client_id IS NOT NULL
      UNION
      SELECT company_id FROM contact_company_associations
      WHERE contact_id = p_contact_id AND is_active = true
    )
  LOOP
    mapped := public.map_company_status_to_contact_status(rec.company_status);
    IF mapped IS NULL THEN CONTINUE; END IF;
    pri := public.contact_status_priority(mapped);
    IF pri > best_pri THEN
      best_pri := pri;
      best := mapped;
    END IF;
  END LOOP;

  RETURN best;
END;
$$;

-- Apply inheritance to a single contact, only if the inherited status is
-- higher-priority than the contact's current status (or contact has no status).
CREATE OR REPLACE FUNCTION public.apply_inherited_status_to_contact(p_contact_id uuid)
RETURNS void
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  current_status text;
  inherited text;
BEGIN
  SELECT status INTO current_status FROM client_contacts WHERE id = p_contact_id;
  inherited := public.compute_inherited_contact_status(p_contact_id);

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

-- Apply inheritance to all contacts linked to a given company
CREATE OR REPLACE FUNCTION public.apply_inherited_status_for_company(p_company_id uuid)
RETURNS void
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  cid uuid;
BEGIN
  FOR cid IN
    SELECT id FROM client_contacts WHERE client_id = p_company_id
    UNION
    SELECT contact_id FROM contact_company_associations
    WHERE company_id = p_company_id AND is_active = true
  LOOP
    PERFORM public.apply_inherited_status_to_contact(cid);
  END LOOP;
END;
$$;

-- Trigger: when a company's status (or manual_status) changes, propagate
CREATE OR REPLACE FUNCTION public.clients_propagate_status_to_contacts()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF (TG_OP = 'INSERT')
     OR (coalesce(NEW.status,'') IS DISTINCT FROM coalesce(OLD.status,''))
     OR (coalesce(NEW.manual_status,'') IS DISTINCT FROM coalesce(OLD.manual_status,''))
  THEN
    PERFORM public.apply_inherited_status_for_company(NEW.id);
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS clients_propagate_status_to_contacts_trg ON public.clients;
CREATE TRIGGER clients_propagate_status_to_contacts_trg
AFTER INSERT OR UPDATE OF status, manual_status ON public.clients
FOR EACH ROW EXECUTE FUNCTION public.clients_propagate_status_to_contacts();

-- Trigger: when a contact_company_association is added/changed/removed,
-- recompute the affected contact's inherited status.
CREATE OR REPLACE FUNCTION public.cca_propagate_status_to_contact()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    PERFORM public.apply_inherited_status_to_contact(OLD.contact_id);
    RETURN OLD;
  ELSE
    PERFORM public.apply_inherited_status_to_contact(NEW.contact_id);
    RETURN NEW;
  END IF;
END;
$$;

DROP TRIGGER IF EXISTS cca_propagate_status_to_contact_trg ON public.contact_company_associations;
CREATE TRIGGER cca_propagate_status_to_contact_trg
AFTER INSERT OR UPDATE OR DELETE ON public.contact_company_associations
FOR EACH ROW EXECUTE FUNCTION public.cca_propagate_status_to_contact();

-- BACKFILL: apply inheritance to every contact right now
DO $$
DECLARE
  cid uuid;
BEGIN
  FOR cid IN SELECT id FROM client_contacts LOOP
    PERFORM public.apply_inherited_status_to_contact(cid);
  END LOOP;
END $$;
