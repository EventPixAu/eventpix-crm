
-- Function to get client portal data by authenticated user's email
CREATE OR REPLACE FUNCTION public.get_client_portal_data()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_email text;
  v_company_ids uuid[];
  v_result jsonb;
BEGIN
  -- Get the authenticated user's email
  SELECT email INTO v_email FROM auth.users WHERE id = auth.uid();
  
  IF v_email IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Not authenticated');
  END IF;

  -- Find all companies associated with this email via client_contacts
  SELECT ARRAY_AGG(DISTINCT company_id) INTO v_company_ids
  FROM (
    -- Direct client_id on client_contacts
    SELECT cc.client_id AS company_id
    FROM client_contacts cc
    WHERE LOWER(cc.email) = LOWER(v_email)
      AND cc.client_id IS NOT NULL
    UNION
    -- Via contact_company_associations
    SELECT cca.company_id
    FROM client_contacts cc
    JOIN contact_company_associations cca ON cca.contact_id = cc.id
    WHERE LOWER(cc.email) = LOWER(v_email)
      AND cca.is_active = true
  ) sub;

  IF v_company_ids IS NULL OR array_length(v_company_ids, 1) IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'No company found for this email');
  END IF;

  -- Build the result
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
        'venue_name', e.venue_name,
        'ops_status', e.ops_status,
        'client_portal_token', e.client_portal_token,
        'created_at', e.created_at,
        'company_name', cl.business_name
      ) ORDER BY e.event_date DESC), '[]'::jsonb)
      FROM events e
      JOIN clients cl ON cl.id = e.client_id
      WHERE e.client_id = ANY(v_company_ids)
        AND e.ops_status NOT IN ('cancelled')
    )
  ) INTO v_result;

  RETURN v_result;
END;
$$;
