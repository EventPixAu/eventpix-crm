-- Replace convert_enquiry_to_event function to include session and notes transfer
CREATE OR REPLACE FUNCTION public.convert_enquiry_to_event(p_input jsonb)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_user_id uuid := auth.uid();
  v_lead_id uuid := (p_input->>'enquiry_id')::uuid;
  v_client_id uuid;
  v_event_id uuid;
  v_venue_id uuid;
  v_created_venue boolean := false;
  v_warnings text[] := array[]::text[];
  v_templates uuid[];
  v_ws_count int := 0;
  v_task_count int := 0;
  v_contact_count int := 0;
  v_session_count int := 0;
  v_event_name text;
  v_event_date date;
  v_start_time time;
  v_end_time time;
  v_lead_record RECORD;
  v_first_session RECORD;
BEGIN
  -- 1) Authorize - check if user has admin role
  IF NOT public.has_role(v_user_id, 'admin') THEN
    RETURN jsonb_build_object('success', false, 'error', 'Unauthorized');
  END IF;

  -- 2) Lock lead row to prevent concurrent conversion
  SELECT * INTO v_lead_record
  FROM leads l
  WHERE l.id = v_lead_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Enquiry not found');
  END IF;

  -- 3) Block duplicate conversion
  IF EXISTS (SELECT 1 FROM events ev WHERE ev.lead_id = v_lead_id) THEN
    RETURN jsonb_build_object('success', false, 'error', 'Enquiry already converted');
  END IF;

  -- 4) Resolve client_id
  v_client_id := COALESCE(
    NULLIF(p_input->>'client_id', '')::uuid,
    v_lead_record.client_id
  );

  IF v_client_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Client not set on enquiry');
  END IF;

  -- 5) Resolve venue
  IF (p_input #>> '{venue,venue_id}') IS NOT NULL AND (p_input #>> '{venue,venue_id}') <> '' THEN
    v_venue_id := (p_input #>> '{venue,venue_id}')::uuid;
    IF NOT EXISTS (SELECT 1 FROM venues v WHERE v.id = v_venue_id) THEN
      RETURN jsonb_build_object('success', false, 'error', 'Invalid venue payload');
    END IF;
  ELSIF (p_input #>> '{venue,create,name}') IS NOT NULL AND (p_input #>> '{venue,create,name}') <> '' THEN
    INSERT INTO venues(name, address, city, state, postcode, country, parking_notes, access_notes)
    VALUES (
      p_input #>> '{venue,create,name}',
      NULLIF(p_input #>> '{venue,create,address_line_1}', ''),
      NULLIF(p_input #>> '{venue,create,suburb}', ''),
      NULLIF(p_input #>> '{venue,create,state}', ''),
      NULLIF(p_input #>> '{venue,create,postcode}', ''),
      NULLIF(p_input #>> '{venue,create,country}', ''),
      NULLIF(p_input #>> '{venue,create,parking_notes}', ''),
      NULLIF(p_input #>> '{venue,create,access_notes}', '')
    )
    RETURNING id INTO v_venue_id;
    v_created_venue := true;
  ELSE
    v_venue_id := NULL;
    v_warnings := array_append(v_warnings, 'Venue is TBC');
  END IF;

  -- 6) Resolve event details
  v_event_name := COALESCE(
    NULLIF(p_input #>> '{event_overrides,event_name}', ''),
    v_lead_record.lead_name
  );
  
  -- Check if lead has sessions - if so, use first session for date/time
  SELECT * INTO v_first_session
  FROM event_sessions es
  WHERE es.lead_id = v_lead_id
  ORDER BY es.session_date, es.sort_order NULLS LAST
  LIMIT 1;
  
  -- Handle date/time - support both start_at (timestamptz) and separate date/time
  IF (p_input #>> '{event_overrides,start_at}') IS NOT NULL AND (p_input #>> '{event_overrides,start_at}') <> '' THEN
    v_event_date := ((p_input #>> '{event_overrides,start_at}')::timestamptz)::date;
    v_start_time := ((p_input #>> '{event_overrides,start_at}')::timestamptz)::time;
  ELSIF (p_input #>> '{event_overrides,event_date}') IS NOT NULL AND (p_input #>> '{event_overrides,event_date}') <> '' THEN
    v_event_date := (p_input #>> '{event_overrides,event_date}')::date;
    v_start_time := NULLIF(p_input #>> '{event_overrides,start_time}', '')::time;
  ELSIF v_first_session.id IS NOT NULL THEN
    -- Use first session's date/time if available
    v_event_date := v_first_session.session_date;
    v_start_time := v_first_session.start_time;
  ELSE
    v_event_date := v_lead_record.estimated_event_date;
    v_start_time := NULL;
  END IF;

  IF (p_input #>> '{event_overrides,end_at}') IS NOT NULL AND (p_input #>> '{event_overrides,end_at}') <> '' THEN
    v_end_time := ((p_input #>> '{event_overrides,end_at}')::timestamptz)::time;
  ELSIF (p_input #>> '{event_overrides,end_time}') IS NOT NULL AND (p_input #>> '{event_overrides,end_time}') <> '' THEN
    v_end_time := (p_input #>> '{event_overrides,end_time}')::time;
  ELSIF v_first_session.id IS NOT NULL THEN
    v_end_time := v_first_session.end_time;
  ELSE
    v_end_time := NULL;
  END IF;

  -- Require event_date
  IF v_event_date IS NULL THEN
    v_warnings := array_append(v_warnings, 'Event date is TBC');
  END IF;

  -- 7) Create event (including notes from lead)
  INSERT INTO events(
    client_id,
    lead_id,
    event_name,
    client_name,
    event_date,
    start_time,
    end_time,
    venue_id,
    venue_name,
    venue_address,
    event_type_id,
    coverage_package_id,
    delivery_deadline,
    special_instructions,
    notes,
    date_status,
    enquiry_source,
    created_by
  )
  SELECT
    v_client_id,
    v_lead_id,
    v_event_name,
    c.business_name,
    COALESCE(v_event_date, CURRENT_DATE),
    v_start_time,
    v_end_time,
    v_venue_id,
    CASE WHEN v_venue_id IS NOT NULL THEN (SELECT ve.name FROM venues ve WHERE ve.id = v_venue_id) ELSE NULL END,
    CASE WHEN v_venue_id IS NOT NULL THEN (SELECT ve.address FROM venues ve WHERE ve.id = v_venue_id) ELSE NULL END,
    COALESCE(NULLIF(p_input #>> '{event_overrides,event_type_id}', '')::uuid, v_lead_record.event_type_id),
    NULLIF(p_input #>> '{event_overrides,coverage_package_id}', '')::uuid,
    NULLIF(p_input #>> '{event_overrides,delivery_deadline_at}', '')::timestamptz,
    COALESCE(NULLIF(p_input #>> '{event_overrides,special_instructions}', ''), v_lead_record.requirements_summary),
    v_lead_record.notes,
    COALESCE(NULLIF(p_input #>> '{event_overrides,date_status}', ''), 'confirmed'),
    v_lead_record.source,
    v_user_id
  FROM clients c
  WHERE c.id = v_client_id
  RETURNING id INTO v_event_id;

  -- 8) Copy enquiry contacts to event_contacts
  IF COALESCE((p_input #>> '{options,copy_enquiry_contacts}')::boolean, true) THEN
    INSERT INTO event_contacts(event_id, client_contact_id, contact_type, contact_name, contact_email, contact_phone)
    SELECT 
      v_event_id,
      ec.contact_id,
      COALESCE(ec.role, 'primary'),
      cc.contact_name,
      cc.email,
      COALESCE(cc.phone_mobile, cc.phone)
    FROM enquiry_contacts ec
    JOIN client_contacts cc ON cc.id = ec.contact_id
    WHERE ec.lead_id = v_lead_id;
    
    GET DIAGNOSTICS v_contact_count = ROW_COUNT;
  END IF;

  -- 8.5) Transfer event sessions from lead to event
  UPDATE event_sessions
  SET 
    event_id = v_event_id,
    updated_at = NOW()
  WHERE lead_id = v_lead_id;
  
  GET DIAGNOSTICS v_session_count = ROW_COUNT;

  -- 9) Create worksheets from workflow templates
  v_templates := COALESCE(
    (SELECT array_agg(t::uuid) FROM jsonb_array_elements_text(p_input #> '{workflow_pack,template_ids}') t),
    array[]::uuid[]
  );

  IF array_length(v_templates, 1) > 0 THEN
    INSERT INTO event_worksheets(event_id, template_id, title)
    SELECT v_event_id, wt.id, wt.name
    FROM workflow_templates wt
    WHERE wt.id = ANY(v_templates);
    
    GET DIAGNOSTICS v_ws_count = ROW_COUNT;
  END IF;

  -- 10) Create default admin setup tasks
  IF COALESCE((p_input #>> '{options,create_admin_setup_tasks}')::boolean, true) THEN
    INSERT INTO tasks(event_id, title, assigned_to, due_date, status)
    VALUES
      (v_event_id, 'Review event brief', v_user_id, v_event_date - INTERVAL '7 days', 'pending'),
      (v_event_id, 'Confirm crew assignments', v_user_id, v_event_date - INTERVAL '3 days', 'pending'),
      (v_event_id, 'Send pre-event client confirmation', v_user_id, v_event_date - INTERVAL '1 day', 'pending');
    
    GET DIAGNOSTICS v_task_count = ROW_COUNT;
  END IF;

  -- 11) Update lead status to won
  UPDATE leads
  SET 
    status = 'won',
    updated_at = NOW()
  WHERE id = v_lead_id;

  -- 12) Audit log
  INSERT INTO audit_log(action, event_id, actor_user_id, before, after)
  VALUES (
    'event_created',
    v_event_id,
    v_user_id,
    jsonb_build_object('lead_id', v_lead_id),
    jsonb_build_object('event_id', v_event_id, 'venue_created', v_created_venue, 'sessions_transferred', v_session_count)
  );

  -- 13) Return result
  RETURN jsonb_build_object(
    'success', true,
    'event_id', v_event_id,
    'venue_id', v_venue_id,
    'created', jsonb_build_object(
      'event', true,
      'venue', v_created_venue,
      'worksheets', v_ws_count,
      'tasks', v_task_count,
      'event_contacts', v_contact_count,
      'sessions', v_session_count
    ),
    'warnings', v_warnings
  );

EXCEPTION WHEN OTHERS THEN
  RETURN jsonb_build_object('success', false, 'error', SQLERRM);
END;
$$;