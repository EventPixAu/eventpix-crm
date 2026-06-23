
CREATE OR REPLACE FUNCTION public.propagate_company_status_to_contacts()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path TO 'public'
AS $$
DECLARE
  contact_rec record;
BEGIN
  IF TG_OP = 'UPDATE'
     AND NEW.status IS NOT DISTINCT FROM OLD.status
     AND NEW.manual_status IS NOT DISTINCT FROM OLD.manual_status THEN
    RETURN NEW;
  END IF;

  FOR contact_rec IN
    SELECT id FROM client_contacts WHERE client_id = NEW.id
    UNION
    SELECT contact_id AS id FROM contact_company_associations
    WHERE company_id = NEW.id AND is_active = true
  LOOP
    PERFORM public.apply_inherited_status_to_contact(contact_rec.id);
  END LOOP;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_propagate_company_status_to_contacts ON public.clients;
CREATE TRIGGER trg_propagate_company_status_to_contacts
AFTER INSERT OR UPDATE OF status, manual_status ON public.clients
FOR EACH ROW
EXECUTE FUNCTION public.propagate_company_status_to_contacts();

-- Backfill all contacts now
DO $$
DECLARE
  r record;
BEGIN
  FOR r IN SELECT id FROM client_contacts LOOP
    PERFORM public.apply_inherited_status_to_contact(r.id);
  END LOOP;
END $$;
