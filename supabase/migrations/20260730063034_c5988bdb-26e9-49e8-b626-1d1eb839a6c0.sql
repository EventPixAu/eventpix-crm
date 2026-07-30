CREATE OR REPLACE FUNCTION public.sync_series_contacts_to_events(_series_id uuid)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _primary uuid;
  _onsite uuid;
  _count integer := 0;
BEGIN
  SELECT primary_contact_id, onsite_contact_id INTO _primary, _onsite
  FROM public.event_series WHERE id = _series_id;

  DELETE FROM public.event_contacts ec
  USING public.events e
  WHERE ec.event_id = e.id
    AND e.event_series_id = _series_id
    AND ec.contact_type IN ('primary','onsite');

  IF _primary IS NOT NULL THEN
    INSERT INTO public.event_contacts (event_id, client_contact_id, contact_type, contact_name, contact_email, contact_phone)
    SELECT e.id, c.id, 'primary', c.contact_name, c.email, COALESCE(c.phone_mobile, c.phone, c.phone_office)
    FROM public.events e
    CROSS JOIN public.client_contacts c
    WHERE e.event_series_id = _series_id AND c.id = _primary;
  END IF;

  IF _onsite IS NOT NULL THEN
    INSERT INTO public.event_contacts (event_id, client_contact_id, contact_type, contact_name, contact_email, contact_phone)
    SELECT e.id, c.id, 'onsite', c.contact_name, c.email, COALESCE(c.phone_mobile, c.phone, c.phone_office)
    FROM public.events e
    CROSS JOIN public.client_contacts c
    WHERE e.event_series_id = _series_id AND c.id = _onsite;
  END IF;

  SELECT count(*) INTO _count FROM public.events WHERE event_series_id = _series_id;
  RETURN _count;
END;
$$;

GRANT EXECUTE ON FUNCTION public.sync_series_contacts_to_events(uuid) TO authenticated;

DO $$
DECLARE r record;
BEGIN
  FOR r IN SELECT id FROM public.event_series WHERE primary_contact_id IS NOT NULL OR onsite_contact_id IS NOT NULL LOOP
    PERFORM public.sync_series_contacts_to_events(r.id);
  END LOOP;
END $$;