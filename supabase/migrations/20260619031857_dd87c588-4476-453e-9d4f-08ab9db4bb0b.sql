
ALTER TABLE public.client_contacts
  ADD COLUMN IF NOT EXISTS category_id uuid REFERENCES public.company_categories(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS subcategory_id uuid REFERENCES public.company_subcategories(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_client_contacts_category_id ON public.client_contacts(category_id);
CREATE INDEX IF NOT EXISTS idx_client_contacts_subcategory_id ON public.client_contacts(subcategory_id);

-- Determine the "primary" company for a contact:
-- 1) direct client_contacts.client_id, else
-- 2) contact_company_associations row with is_primary=true and is_active, else
-- 3) earliest active association
CREATE OR REPLACE FUNCTION public.get_contact_primary_company(_contact_id uuid)
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(
    (SELECT client_id FROM public.client_contacts WHERE id = _contact_id AND client_id IS NOT NULL),
    (SELECT company_id FROM public.contact_company_associations
       WHERE contact_id = _contact_id AND is_active = true AND is_primary = true
       ORDER BY created_at ASC LIMIT 1),
    (SELECT company_id FROM public.contact_company_associations
       WHERE contact_id = _contact_id AND is_active = true
       ORDER BY created_at ASC LIMIT 1)
  );
$$;

-- Apply inherited category from primary company to a contact
CREATE OR REPLACE FUNCTION public.apply_inherited_category_to_contact(_contact_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _primary_company uuid;
  _cat_id uuid;
  _sub_id uuid;
BEGIN
  _primary_company := public.get_contact_primary_company(_contact_id);

  IF _primary_company IS NULL THEN
    UPDATE public.client_contacts
       SET category_id = NULL, subcategory_id = NULL
     WHERE id = _contact_id
       AND (category_id IS NOT NULL OR subcategory_id IS NOT NULL);
    RETURN;
  END IF;

  SELECT category_id, subcategory_id
    INTO _cat_id, _sub_id
  FROM public.clients
  WHERE id = _primary_company;

  UPDATE public.client_contacts
     SET category_id = _cat_id,
         subcategory_id = _sub_id
   WHERE id = _contact_id
     AND (category_id IS DISTINCT FROM _cat_id OR subcategory_id IS DISTINCT FROM _sub_id);
END;
$$;

-- Trigger on clients: when category changes, refresh all linked contacts
CREATE OR REPLACE FUNCTION public.clients_propagate_category_to_contacts()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _contact_id uuid;
BEGIN
  IF (NEW.category_id IS DISTINCT FROM OLD.category_id)
     OR (NEW.subcategory_id IS DISTINCT FROM OLD.subcategory_id) THEN
    -- Direct client_id links
    FOR _contact_id IN
      SELECT id FROM public.client_contacts WHERE client_id = NEW.id
    LOOP
      PERFORM public.apply_inherited_category_to_contact(_contact_id);
    END LOOP;
    -- Junction-table links
    FOR _contact_id IN
      SELECT contact_id FROM public.contact_company_associations
       WHERE company_id = NEW.id AND is_active = true
    LOOP
      PERFORM public.apply_inherited_category_to_contact(_contact_id);
    END LOOP;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS clients_propagate_category_to_contacts_trg ON public.clients;
CREATE TRIGGER clients_propagate_category_to_contacts_trg
AFTER UPDATE OF category_id, subcategory_id ON public.clients
FOR EACH ROW EXECUTE FUNCTION public.clients_propagate_category_to_contacts();

-- Trigger on contact_company_associations: refresh contact category when links change
CREATE OR REPLACE FUNCTION public.cca_propagate_category_to_contact()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    PERFORM public.apply_inherited_category_to_contact(OLD.contact_id);
    RETURN OLD;
  ELSE
    PERFORM public.apply_inherited_category_to_contact(NEW.contact_id);
    RETURN NEW;
  END IF;
END;
$$;

DROP TRIGGER IF EXISTS cca_propagate_category_to_contact_trg ON public.contact_company_associations;
CREATE TRIGGER cca_propagate_category_to_contact_trg
AFTER INSERT OR UPDATE OR DELETE ON public.contact_company_associations
FOR EACH ROW EXECUTE FUNCTION public.cca_propagate_category_to_contact();

-- Trigger on client_contacts: refresh when direct client_id changes
CREATE OR REPLACE FUNCTION public.client_contacts_inherit_category_on_link_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'INSERT' OR (NEW.client_id IS DISTINCT FROM OLD.client_id) THEN
    PERFORM public.apply_inherited_category_to_contact(NEW.id);
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS client_contacts_inherit_category_trg ON public.client_contacts;
CREATE TRIGGER client_contacts_inherit_category_trg
AFTER INSERT OR UPDATE OF client_id ON public.client_contacts
FOR EACH ROW EXECUTE FUNCTION public.client_contacts_inherit_category_on_link_change();

-- Backfill all existing contacts
DO $$
DECLARE
  _cid uuid;
BEGIN
  FOR _cid IN SELECT id FROM public.client_contacts LOOP
    PERFORM public.apply_inherited_category_to_contact(_cid);
  END LOOP;
END $$;
