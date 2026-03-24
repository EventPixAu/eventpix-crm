CREATE OR REPLACE FUNCTION public.convert_enquiry_to_event(p_input jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
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
  v_workflow_count int := 0;
  v_event_name text;
  v_event_date date;
  v_start_time time;
  v_end_time time;
  v_lead_record RECORD;
  v_first_session RECORD;
  v_workflow_result jsonb;
BEGIN
  IF NOT public.has_role(v_user_id, 'admin') THEN
    RETURN jsonb_build_object('success', false, 'error', 'Unauthorized');
  END IF;

  SELECT * INTO v_lead_record FROM leads l WHERE l.id = v_lead_id FOR UPDATE;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Enquiry not found');
  END IF;

  IF EXISTS (SELECT 1 FROM events ev WHERE ev.lead_id = v_lead_id) THEN
    RETURN jsonb_build_object('success', false, 'error', 'Enquiry already converted');
  END IF;

  v_client_id := COALESCE(NULLIF(p_input->>'client_id', '')::uuid, v_lead_record.client_id);
  IF v_client_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Client not set on enquiry');
  END IF;

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

  v_event_name := COALESCE(NULLIF(p_input #>> '{event_overrides,event_name}', ''), v_lead_record.lead_name);

  SELECT * INTO v_first_session
  FROM event_sessions es WHERE es.lead_id = v_lead_id
  ORDER BY es.session_date, es.sort_order NULLS LAST LIMIT 1;

  IF (p_input #>> '{event_overrides,start_at}') IS NOT NULL AND (p_input #>> '{event_overrides,start_at}') <> '' THEN
    v_event_date := ((p_input #>> '{event_overrides,start_at}')::timestamptz)::date;
    v_start_time := ((p_input #>> '{event_overrides,start_at}')::timestamptz)::time;
  ELSIF (p_input #>> '{event_overrides,event_date}') IS NOT NULL AND (p_input #>> '{event_overrides,event_date}') <> '' THEN
    v_event_date := (p_input #>> '{event_overrides,event_date}')::date;
    v_start_time := NULLIF(p_input #>> '{event_overrides,start_time}', '')::time;
  ELSIF v_first_session.id IS NOT NULL THEN
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

  IF v_event_date IS NULL THEN
    v_warnings := array_append(v_warnings, 'Event date is TBC');
  END IF;

  INSERT INTO events(
    client_id, lead_id, event_name, client_name, event_date, start_time, end_time,
    venue_id, venue_name, venue_address, event_type_id, coverage_package_id,
    delivery_deadline, special_instructions, notes, date_status, enquiry_source, created_by
  )
  SELECT
    v_client_id, v_lead_id, v_event_name, c.business_name,
    COALESCE(v_event_date, CURRENT_DATE), v_start_time, v_end_time,
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
  FROM clients c WHERE c.id = v_client_id
  RETURNING id INTO v_event_id;

  IF COALESCE((p_input #>> '{options,copy_enquiry_contacts}')::boolean, true) THEN
    INSERT INTO event_contacts(event_id, client_contact_id, contact_type, contact_name, contact_email, contact_phone)
    SELECT
      v_event_id,
      ec.contact_id,
      public.map_lead_role_to_event_contact_type(COALESCE(ec.role, 'primary')),
      cc.contact_name,
      cc.email,
      COALESCE(cc.phone_mobile, cc.phone)
    FROM enquiry_contacts ec
    JOIN client_contacts cc ON cc.id = ec.contact_id
    WHERE ec.lead_id = v_lead_id;
    GET DIAGNOSTICS v_contact_count = ROW_COUNT;
  END IF;

  UPDATE event_sessions
  SET event_id = v_event_id,
      lead_id = NULL,
      updated_at = NOW()
  WHERE lead_id = v_lead_id;
  GET DIAGNOSTICS v_session_count = ROW_COUNT;

  v_workflow_result := public.initialize_all_operations_workflows(v_event_id);
  v_workflow_count := COALESCE((v_workflow_result->>'steps_created')::int, 0);
  IF NOT COALESCE((v_workflow_result->>'success')::boolean, false) THEN
    v_warnings := array_append(v_warnings, 'Failed to initialize workflows: ' || COALESCE(v_workflow_result->>'error', 'Unknown'));
  END IF;

  IF COALESCE((p_input #>> '{options,create_admin_setup_tasks}')::boolean, true) THEN
    INSERT INTO tasks(event_id, title, assigned_to, due_date, status)
    VALUES
      (v_event_id, 'Review event brief', v_user_id, v_event_date - INTERVAL '7 days', 'pending'),
      (v_event_id, 'Confirm crew assignments', v_user_id, v_event_date - INTERVAL '3 days', 'pending'),
      (v_event_id, 'Send pre-event client confirmation', v_user_id, v_event_date - INTERVAL '1 day', 'pending');
    GET DIAGNOSTICS v_task_count = ROW_COUNT;
  END IF;

  UPDATE leads SET status = 'won', updated_at = NOW(), converted_job_id = v_event_id WHERE id = v_lead_id;

  INSERT INTO audit_log(action, event_id, actor_user_id, before, after)
  VALUES (
    'event_created', v_event_id, v_user_id,
    jsonb_build_object('lead_id', v_lead_id),
    jsonb_build_object('event_id', v_event_id, 'venue_created', v_created_venue, 'sessions_transferred', v_session_count, 'workflow_steps', v_workflow_count)
  );

  RETURN jsonb_build_object(
    'success', true,
    'event_id', v_event_id,
    'venue_id', v_venue_id,
    'created', jsonb_build_object(
      'event', true, 'venue', v_created_venue, 'worksheets', v_ws_count,
      'tasks', v_task_count, 'event_contacts', v_contact_count,
      'sessions', v_session_count, 'workflow_steps', v_workflow_count
    ),
    'warnings', v_warnings
  );

EXCEPTION WHEN OTHERS THEN
  RETURN jsonb_build_object('success', false, 'error', SQLERRM);
END;
$function$;

CREATE OR REPLACE FUNCTION public.convert_enquiry_to_event(p_lead_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
DECLARE
  v_lead_record leads%ROWTYPE;
  v_event_id uuid;
  v_venue_id uuid;
  v_worksheet_count int := 0;
  v_task_count int := 0;
  v_contact_count int := 0;
  v_session_count int := 0;
  v_assignment_count int := 0;
  v_workflow_step_count int := 0;
  v_quote_count int := 0;
  v_contract_count int := 0;
  v_warnings text[] := '{}';
  v_first_session RECORD;
  v_accepted_quote RECORD;
BEGIN
  SELECT * INTO v_lead_record FROM leads WHERE id = p_lead_id;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Lead not found');
  END IF;

  IF v_lead_record.converted_job_id IS NOT NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Lead already converted to event');
  END IF;

  IF v_lead_record.venue_text IS NOT NULL AND v_lead_record.venue_text != '' THEN
    INSERT INTO venues (name, address_line_1)
    VALUES (v_lead_record.venue_text, v_lead_record.venue_text)
    RETURNING id INTO v_venue_id;
  END IF;

  SELECT * INTO v_accepted_quote
  FROM quotes WHERE lead_id = p_lead_id AND status = 'accepted'
  ORDER BY updated_at DESC LIMIT 1;

  SELECT * INTO v_first_session
  FROM event_sessions WHERE lead_id = p_lead_id
  ORDER BY session_date, sort_order NULLS LAST LIMIT 1;

  INSERT INTO events (
    event_name, client_name, client_id, event_date, event_type_id,
    special_instructions, lead_id, venue_id, venue_name, enquiry_source,
    notes, ops_status, is_training, main_shoot_date, booking_date, quote_id,
    start_time, end_time
  )
  VALUES (
    v_lead_record.lead_name,
    COALESCE((SELECT business_name FROM clients WHERE id = v_lead_record.client_id), 'TBC'),
    v_lead_record.client_id,
    COALESCE(v_first_session.session_date, v_lead_record.estimated_event_date, CURRENT_DATE),
    v_lead_record.event_type_id,
    v_lead_record.requirements_summary,
    p_lead_id, v_venue_id, v_lead_record.venue_text, v_lead_record.source,
    v_lead_record.notes, 'awaiting_details', v_lead_record.is_training,
    COALESCE(v_first_session.session_date, v_lead_record.estimated_event_date),
    CURRENT_DATE, v_accepted_quote.id,
    v_first_session.start_time, v_first_session.end_time
  )
  RETURNING id INTO v_event_id;

  INSERT INTO event_contacts (event_id, client_contact_id, contact_type, contact_name, contact_email, contact_phone, notes)
  SELECT v_event_id, ec.contact_id,
    public.map_lead_role_to_event_contact_type(COALESCE(ec.role, 'primary')),
    COALESCE(ec.contact_name, cc.contact_name),
    COALESCE(ec.contact_email, cc.email),
    COALESCE(ec.contact_phone, COALESCE(cc.phone_mobile, cc.phone)),
    ec.notes
  FROM enquiry_contacts ec
  LEFT JOIN client_contacts cc ON cc.id = ec.contact_id
  WHERE ec.lead_id = p_lead_id;
  GET DIAGNOSTICS v_contact_count = ROW_COUNT;

  UPDATE event_sessions
  SET event_id = v_event_id,
      lead_id = NULL,
      updated_at = NOW()
  WHERE lead_id = p_lead_id;
  GET DIAGNOSTICS v_session_count = ROW_COUNT;

  IF v_session_count = 0 AND v_lead_record.estimated_event_date IS NOT NULL THEN
    INSERT INTO event_sessions (event_id, label, session_date)
    VALUES (v_event_id, 'Main Session', v_lead_record.estimated_event_date);
    v_session_count := 1;
  END IF;

  INSERT INTO event_assignments (event_id, user_id, staff_role_id, session_id, status, assignment_notes)
  SELECT v_event_id, la.user_id, la.staff_role_id,
    (SELECT es.id FROM event_sessions es WHERE es.event_id = v_event_id ORDER BY es.sort_order LIMIT 1),
    'confirmed', la.assignment_notes
  FROM lead_assignments la
  WHERE la.lead_id = p_lead_id;
  GET DIAGNOSTICS v_assignment_count = ROW_COUNT;

  UPDATE quotes SET event_id = v_event_id WHERE lead_id = p_lead_id;
  GET DIAGNOSTICS v_quote_count = ROW_COUNT;
  UPDATE contracts SET event_id = v_event_id WHERE lead_id = p_lead_id;
  GET DIAGNOSTICS v_contract_count = ROW_COUNT;
  UPDATE email_logs SET event_id = v_event_id WHERE lead_id = p_lead_id AND event_id IS NULL;
  UPDATE leads SET converted_job_id = v_event_id, status = 'won' WHERE id = p_lead_id;

  IF v_lead_record.client_id IS NOT NULL THEN
    UPDATE clients SET status = 'active_event' WHERE id = v_lead_record.client_id;
  END IF;

  RETURN jsonb_build_object(
    'success', true,
    'event_id', v_event_id,
    'venue_id', v_venue_id,
    'created', jsonb_build_object(
      'event', true,
      'venue', v_venue_id IS NOT NULL,
      'worksheets', v_worksheet_count,
      'tasks', v_task_count,
      'event_contacts', v_contact_count,
      'sessions', v_session_count,
      'workflow_steps', v_workflow_step_count,
      'quotes_linked', v_quote_count,
      'contracts_linked', v_contract_count
    ),
    'warnings', to_jsonb(v_warnings)
  );
END;
$function$;