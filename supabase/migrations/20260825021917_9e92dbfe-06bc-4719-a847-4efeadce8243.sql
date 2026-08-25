CREATE OR REPLACE FUNCTION public.get_client_portal_data()
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_email text;
  v_company_ids uuid[];
  v_event_ids uuid[];
  v_result jsonb;
BEGIN
  SELECT email INTO v_email FROM auth.users WHERE id = auth.uid();

  IF v_email IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Not authenticated');
  END IF;

  SELECT ARRAY_AGG(DISTINCT company_id) INTO v_company_ids
  FROM (
    SELECT cc.client_id AS company_id
    FROM client_contacts cc
    WHERE LOWER(cc.email) = LOWER(v_email)
      AND cc.client_id IS NOT NULL
    UNION
    SELECT cca.company_id
    FROM client_contacts cc
    JOIN contact_company_associations cca ON cca.contact_id = cc.id
    WHERE LOWER(cc.email) = LOWER(v_email)
      AND cca.is_active = true
  ) sub;

  -- Events where this person is directly listed as a contact
  SELECT ARRAY_AGG(DISTINCT ec.event_id) INTO v_event_ids
  FROM event_contacts ec
  LEFT JOIN client_contacts cc ON cc.id = ec.client_contact_id
  WHERE LOWER(COALESCE(ec.contact_email, cc.email, '')) = LOWER(v_email);

  v_company_ids := COALESCE(v_company_ids, ARRAY[]::uuid[]);
  v_event_ids := COALESCE(v_event_ids, ARRAY[]::uuid[]);

  IF array_length(v_company_ids, 1) IS NULL AND array_length(v_event_ids, 1) IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'No company found for this email');
  END IF;

  SELECT jsonb_build_object(
    'success', true,
    'companies', (
      SELECT COALESCE(jsonb_agg(jsonb_build_object(
        'id', c.id,
        'business_name', c.business_name,
        'trading_name', c.trading_name
      )), '[]'::jsonb)
      FROM clients c
      WHERE c.id = ANY(v_company_ids)
    ),
    'leads', (
      SELECT COALESCE(jsonb_agg(jsonb_build_object(
        'id', l.id,
        'lead_name', l.lead_name,
        'status', l.status,
        'estimated_event_date', l.estimated_event_date,
        'venue_text', l.venue_text,
        'client_portal_token', l.client_portal_token,
        'created_at', l.created_at,
        'updated_at', l.updated_at,
        'company_name', cl.business_name
      ) ORDER BY l.created_at DESC), '[]'::jsonb)
      FROM leads l
      JOIN clients cl ON cl.id = l.client_id
      WHERE l.client_id = ANY(v_company_ids)
        AND l.status NOT IN ('lost', 'cancelled')
        AND l.converted_job_id IS NULL
    ),
    'events', (
      SELECT COALESCE(jsonb_agg(jsonb_build_object(
        'id', e.id,
        'event_name', e.event_name,
        'event_date', e.event_date,
        'start_time', e.start_time,
        'end_time', e.end_time,
        'venue_name', e.venue_name,
        'venue_address', e.venue_address,
        'ops_status', e.ops_status,
        'client_portal_token', e.client_portal_token,
        'created_at', e.created_at,
        'company_name', cl.business_name,
        'series_id', e.event_series_id,
        'series_name', es.name,
        'crew', (
          SELECT COALESCE(jsonb_agg(jsonb_build_object(
            'name', p.full_name,
            'role', sr.name,
            'dietary_requirements', CASE WHEN COALESCE(e.share_team_dietary, false)
              THEN p.dietary_requirements ELSE NULL END
          ) ORDER BY p.full_name), '[]'::jsonb)
          FROM event_assignments ea
          JOIN profiles p ON p.id = ea.user_id
          LEFT JOIN staff_roles sr ON sr.id = ea.staff_role_id
          WHERE ea.event_id = e.id
        )
      ) ORDER BY e.event_date), '[]'::jsonb)
      FROM events e
      LEFT JOIN clients cl ON cl.id = e.client_id
      LEFT JOIN event_series es ON es.id = e.event_series_id
      WHERE (e.client_id = ANY(v_company_ids) OR e.id = ANY(v_event_ids))
        AND COALESCE(e.ops_status, '') <> 'cancelled'
    )
  ) INTO v_result;

  RETURN v_result;
END;
$$;