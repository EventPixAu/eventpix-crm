ALTER TABLE public.venues
  ADD COLUMN IF NOT EXISTS needs_crew_review boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS crew_updated_at timestamptz,
  ADD COLUMN IF NOT EXISTS crew_updated_by uuid,
  ADD COLUMN IF NOT EXISTS crew_updated_by_name text;

CREATE OR REPLACE FUNCTION public.crew_update_venue(
  _venue_id uuid,
  _updates jsonb,
  _note text DEFAULT NULL
)
RETURNS public.venues
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_name text;
  v_venue public.venues;
  v_admin record;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  SELECT COALESCE(NULLIF(TRIM(CONCAT_WS(' ', p.first_name, p.last_name)), ''), p.email, 'Crew member')
    INTO v_name
  FROM public.profiles p WHERE p.id = v_uid;
  v_name := COALESCE(v_name, 'Crew member');

  UPDATE public.venues v SET
    access_notes = COALESCE(NULLIF(TRIM(_updates->>'access_notes'), ''), v.access_notes),
    parking_access = COALESCE(NULLIF(TRIM(_updates->>'parking_access'), ''), v.parking_access),
    parking_cost = COALESCE(NULLIF(TRIM(_updates->>'parking_cost'), ''), v.parking_cost),
    public_wifi_ssid = COALESCE(NULLIF(TRIM(_updates->>'public_wifi_ssid'), ''), v.public_wifi_ssid),
    public_wifi_password = COALESCE(NULLIF(TRIM(_updates->>'public_wifi_password'), ''), v.public_wifi_password),
    event_wifi_ssid = COALESCE(NULLIF(TRIM(_updates->>'event_wifi_ssid'), ''), v.event_wifi_ssid),
    event_wifi_password = COALESCE(NULLIF(TRIM(_updates->>'event_wifi_password'), ''), v.event_wifi_password),
    internet_notes = COALESCE(NULLIF(TRIM(_updates->>'internet_notes'), ''), v.internet_notes),
    telstra_signal = COALESCE(NULLIF(TRIM(_updates->>'telstra_signal'), ''), v.telstra_signal),
    optus_signal = COALESCE(NULLIF(TRIM(_updates->>'optus_signal'), ''), v.optus_signal),
    signal_notes = COALESCE(NULLIF(TRIM(_updates->>'signal_notes'), ''), v.signal_notes),
    events_contact_name = COALESCE(NULLIF(TRIM(_updates->>'events_contact_name'), ''), v.events_contact_name),
    events_contact_phone = COALESCE(NULLIF(TRIM(_updates->>'events_contact_phone'), ''), v.events_contact_phone),
    events_contact_email = COALESCE(NULLIF(TRIM(_updates->>'events_contact_email'), ''), v.events_contact_email),
    is_confirmed = false,
    needs_crew_review = true,
    crew_updated_at = now(),
    crew_updated_by = v_uid,
    crew_updated_by_name = v_name,
    updated_at = now()
  WHERE v.id = _venue_id
  RETURNING * INTO v_venue;

  IF v_venue.id IS NULL THEN
    RAISE EXCEPTION 'Venue not found';
  END IF;

  IF _note IS NOT NULL AND TRIM(_note) <> '' THEN
    INSERT INTO public.venue_notes (venue_id, note, created_by)
    VALUES (_venue_id, TRIM(_note), v_uid);
  END IF;

  INSERT INTO public.venue_notes (venue_id, note, created_by)
  VALUES (
    _venue_id,
    'Venue details updated by ' || v_name || ' on ' || to_char(now() AT TIME ZONE 'Australia/Sydney', 'DD Mon YYYY, HH12:MI AM') || ' from Day-Of View',
    v_uid
  );

  FOR v_admin IN SELECT ur.user_id FROM public.user_roles ur WHERE ur.role = 'admin'::app_role LOOP
    INSERT INTO public.notifications (user_id, type, title, message, entity_type, entity_id, severity, delivery_channel)
    VALUES (
      v_admin.user_id,
      'venue_crew_update',
      'Venue record updated: ' || v_venue.name,
      'Venue record updated: ' || v_venue.name || ' — updated by ' || v_name || ' on '
        || to_char(now() AT TIME ZONE 'Australia/Sydney', 'DD Mon YYYY') || '. Tap to review.',
      'venue',
      _venue_id,
      'info',
      'in_app'
    );
  END LOOP;

  RETURN v_venue;
END;
$$;

REVOKE ALL ON FUNCTION public.crew_update_venue(uuid, jsonb, text) FROM public;
GRANT EXECUTE ON FUNCTION public.crew_update_venue(uuid, jsonb, text) TO authenticated;