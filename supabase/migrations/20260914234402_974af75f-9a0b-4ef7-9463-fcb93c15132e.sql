CREATE TABLE public.event_agency_crew (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id uuid NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
  session_id uuid REFERENCES public.event_sessions(id) ON DELETE SET NULL,
  name text NOT NULL CHECK (char_length(btrim(name)) BETWEEN 1 AND 200),
  role text NOT NULL CHECK (char_length(btrim(role)) BETWEEN 1 AND 120),
  agency text NOT NULL CHECK (char_length(btrim(agency)) BETWEEN 1 AND 200),
  phone text NOT NULL CHECK (char_length(btrim(phone)) BETWEEN 1 AND 50),
  email text CHECK (email IS NULL OR char_length(email) <= 320),
  notes text CHECK (notes IS NULL OR char_length(notes) <= 2000),
  created_by uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.event_agency_crew TO authenticated;
GRANT ALL ON public.event_agency_crew TO service_role;

ALTER TABLE public.event_agency_crew ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authorized users can view agency crew"
ON public.event_agency_crew
FOR SELECT
TO authenticated
USING (
  public.current_user_role() IN ('admin', 'operations', 'sales', 'executive')
  OR public.is_assigned_to_event(auth.uid(), event_id)
);

CREATE POLICY "Admins and operations can add agency crew"
ON public.event_agency_crew
FOR INSERT
TO authenticated
WITH CHECK (
  public.current_user_role() IN ('admin', 'operations')
  AND created_by = auth.uid()
);

CREATE POLICY "Admins and operations can update agency crew"
ON public.event_agency_crew
FOR UPDATE
TO authenticated
USING (public.current_user_role() IN ('admin', 'operations'))
WITH CHECK (public.current_user_role() IN ('admin', 'operations'));

CREATE POLICY "Admins and operations can remove agency crew"
ON public.event_agency_crew
FOR DELETE
TO authenticated
USING (public.current_user_role() IN ('admin', 'operations'));

CREATE INDEX event_agency_crew_event_id_idx ON public.event_agency_crew(event_id);
CREATE INDEX event_agency_crew_session_id_idx ON public.event_agency_crew(session_id);

CREATE TRIGGER update_event_agency_crew_updated_at
BEFORE UPDATE ON public.event_agency_crew
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

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
        'meal_provided', CASE WHEN COALESCE(e.share_meal_info, false) THEN e.meal_provided ELSE NULL END,
        'parking_provided', CASE WHEN COALESCE(e.share_parking_info, false) THEN e.parking_provided ELSE NULL END,
        'crew', (
          SELECT COALESCE(jsonb_agg(crew_member.item ORDER BY crew_member.name), '[]'::jsonb)
          FROM (
            SELECT p.full_name AS name, jsonb_build_object(
              'name', p.full_name,
              'role', sr.name,
              'dietary_requirements', CASE WHEN COALESCE(e.share_team_dietary, false) THEN p.dietary_requirements ELSE NULL END,
              'agency', NULL,
              'phone', NULL,
              'email', NULL,
              'is_agency', false
            ) AS item
            FROM event_assignments ea
            JOIN profiles p ON p.id = ea.user_id
            LEFT JOIN staff_roles sr ON sr.id = ea.staff_role_id
            WHERE ea.event_id = e.id
            UNION ALL
            SELECT ac.name, jsonb_build_object(
              'name', ac.name,
              'role', ac.role,
              'dietary_requirements', NULL,
              'agency', ac.agency,
              'phone', ac.phone,
              'email', ac.email,
              'is_agency', true
            ) AS item
            FROM event_agency_crew ac
            WHERE ac.event_id = e.id
          ) crew_member
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