CREATE OR REPLACE FUNCTION public.sync_series_contacts_to_events(_series_id uuid)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _primary uuid;
  _onsite uuid;
  _default uuid;
  _additional uuid[];
  _count integer := 0;
BEGIN
  SELECT primary_contact_id, onsite_contact_id, default_contact_id, COALESCE(additional_contact_ids, '{}')
    INTO _primary, _onsite, _default, _additional
  FROM public.event_series WHERE id = _series_id;

  -- Primary contact is shared across the whole series
  DELETE FROM public.event_contacts ec
  USING public.events e
  WHERE ec.event_id = e.id
    AND e.event_series_id = _series_id
    AND ec.contact_type = 'primary';

  IF _primary IS NULL THEN
    _primary := _default;
  END IF;

  IF _primary IS NOT NULL THEN
    INSERT INTO public.event_contacts (event_id, client_contact_id, contact_type, contact_name, contact_email, contact_phone)
    SELECT e.id, c.id, 'primary', c.contact_name, c.email, COALESCE(c.phone_mobile, c.phone, c.phone_office)
    FROM public.events e
    CROSS JOIN public.client_contacts c
    WHERE e.event_series_id = _series_id AND c.id = _primary;
  END IF;

  -- On-site contacts vary per event: only seed events that have none yet
  IF _onsite IS NOT NULL THEN
    INSERT INTO public.event_contacts (event_id, client_contact_id, contact_type, contact_name, contact_email, contact_phone)
    SELECT e.id, c.id, 'onsite', c.contact_name, c.email, COALESCE(c.phone_mobile, c.phone, c.phone_office)
    FROM public.events e
    CROSS JOIN public.client_contacts c
    WHERE e.event_series_id = _series_id AND c.id = _onsite
      AND NOT EXISTS (
        SELECT 1 FROM public.event_contacts ec2
        WHERE ec2.event_id = e.id AND ec2.contact_type = 'onsite'
      );
  END IF;

  -- Additional series contacts: copied onto every event (skip duplicates)
  IF array_length(_additional, 1) > 0 THEN
    INSERT INTO public.event_contacts (event_id, client_contact_id, contact_type, contact_name, contact_email, contact_phone)
    SELECT e.id, c.id, 'other', c.contact_name, c.email, COALESCE(c.phone_mobile, c.phone, c.phone_office)
    FROM public.events e
    CROSS JOIN public.client_contacts c
    WHERE e.event_series_id = _series_id
      AND c.id = ANY(_additional)
      AND c.id IS DISTINCT FROM _primary
      AND c.id IS DISTINCT FROM _onsite
      AND NOT EXISTS (
        SELECT 1 FROM public.event_contacts ec3
        WHERE ec3.event_id = e.id AND ec3.client_contact_id = c.id
      );
  END IF;

  SELECT count(*) INTO _count FROM public.events WHERE event_series_id = _series_id;
  RETURN _count;
END;
$$;

CREATE OR REPLACE FUNCTION public.apply_series_contacts_to_new_event()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _primary uuid;
  _additional uuid[];
BEGIN
  IF NEW.event_series_id IS NULL THEN
    RETURN NEW;
  END IF;

  SELECT COALESCE(primary_contact_id, default_contact_id), COALESCE(additional_contact_ids, '{}')
    INTO _primary, _additional
  FROM public.event_series WHERE id = NEW.event_series_id;

  IF _primary IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM public.event_contacts ec
    WHERE ec.event_id = NEW.id AND ec.contact_type = 'primary'
  ) THEN
    INSERT INTO public.event_contacts (event_id, client_contact_id, contact_type, contact_name, contact_email, contact_phone)
    SELECT NEW.id, c.id, 'primary', c.contact_name, c.email, COALESCE(c.phone_mobile, c.phone, c.phone_office)
    FROM public.client_contacts c WHERE c.id = _primary;
  END IF;

  IF array_length(_additional, 1) > 0 THEN
    INSERT INTO public.event_contacts (event_id, client_contact_id, contact_type, contact_name, contact_email, contact_phone)
    SELECT NEW.id, c.id, 'other', c.contact_name, c.email, COALESCE(c.phone_mobile, c.phone, c.phone_office)
    FROM public.client_contacts c
    WHERE c.id = ANY(_additional)
      AND c.id IS DISTINCT FROM _primary
      AND NOT EXISTS (
        SELECT 1 FROM public.event_contacts ec2
        WHERE ec2.event_id = NEW.id AND ec2.client_contact_id = c.id
      );
  END IF;

  RETURN NEW;
END;
$$;

DO $$
DECLARE r record;
BEGIN
  FOR r IN SELECT id FROM public.event_series LOOP
    PERFORM public.sync_series_contacts_to_events(r.id);
  END LOOP;
END $$;