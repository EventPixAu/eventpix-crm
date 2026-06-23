CREATE OR REPLACE FUNCTION public.apply_inherited_status_to_contact(p_contact_id uuid)
RETURNS void
LANGUAGE plpgsql
SET search_path TO 'public'
AS $function$
DECLARE
  current_status text;
  inherited text;
  has_active boolean;
BEGIN
  SELECT status INTO current_status FROM client_contacts WHERE id = p_contact_id;

  IF NOT FOUND THEN
    RETURN;
  END IF;

  has_active := public.contact_has_open_lead_or_active_event(p_contact_id);

  -- Active is valid only while a contact is tied to an open lead or active event.
  IF has_active THEN
    UPDATE client_contacts
    SET status = 'Active'
    WHERE id = p_contact_id
      AND status IS DISTINCT FROM 'Active';
    RETURN;
  END IF;

  inherited := public.compute_inherited_contact_status(p_contact_id);

  -- Defensive: company inheritance must never assign Active.
  IF inherited = 'Active' THEN
    inherited := 'Current';
  END IF;

  -- If no linked company can provide a status, only remove invalid Active.
  IF inherited IS NULL THEN
    IF current_status = 'Active' THEN
      UPDATE client_contacts
      SET status = NULL
      WHERE id = p_contact_id
        AND status IS DISTINCT FROM NULL;
    END IF;
    RETURN;
  END IF;

  -- Company status is authoritative for non-active contacts, including demotions.
  UPDATE client_contacts
  SET status = inherited
  WHERE id = p_contact_id
    AND status IS DISTINCT FROM inherited;
END;
$function$;

DO $$
DECLARE
  r record;
BEGIN
  FOR r IN SELECT id FROM public.client_contacts LOOP
    PERFORM public.apply_inherited_status_to_contact(r.id);
  END LOOP;
END $$;