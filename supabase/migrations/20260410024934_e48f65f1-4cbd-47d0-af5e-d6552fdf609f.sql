CREATE OR REPLACE FUNCTION public.convert_enquiry_to_event(p_input jsonb)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id uuid := auth.uid();
  v_lead_id uuid := (p_input->>'enquiry_id')::uuid;
  v_client_id uuid;
  v_event_id uuid;
  v_venue_id uuid;
  v_created_venue boolean := false;
  v_warnings text[] := array[]::text[];
  v_ws_count int := 0;
  v_task_count int := 0;
  v_contact_count int := 0;
  v_session_count int := 0;
  v_workflow_count int := 0;
  v_quote_count int := 0;
  v_contract_count int := 0;
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

  SELECT * INTO v_lead_record
  FROM public.leads l
  WHERE l.id = v_lead_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Enquiry not found');
  END IF;

  IF EXISTS (SELECT 1 FROM public.events ev WHERE ev.lead_id = v_lead_id) THEN
    RETURN jsonb_build_object('success', false, 'error', 'Enquiry already converted');
  END IF;

  v_client_id := COALESCE(NULLIF(p_input->>'client_id', '')::uuid, v_lead_record.client_id);
  IF v_client_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Client not set on enquiry');
  END IF;

  IF (p_input #>> '{venue,venue_id}') IS NOT NULL AND (p_input #>> '{venue,venue_id}') <> '' THEN
    v_venue_id := (p_input #>> '{venue,venue_id}')::uuid;
    IF NOT EXISTS (SELECT 1 FROM public.venues v WHERE v.id = v_venue_id) THEN
      RETURN jsonb_build_object('success', false, 'error', 'Invalid venue payload');
    END IF;
  ELSIF (p_input #>> '{venue,create,name}') IS NOT NULL AND (p_input #>> '{venue,create,name}') <> '' THEN
    INSERT INTO public.venues (
      name, address_line_1, suburb, state, postcode, country, parking_notes, access_notes
    )
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
  FROM public.event_sessions es
  WHERE es.lead_id = v_lead_id
  ORDER BY es.session_date, es.sort_order NULLS LAST
  LIMIT 1;

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

  INSERT INTO public.events (
    client_id, lead_id, event_name, client_name, event_date, start_time, end_time,
    venue_id, venue_name, venue_address, event_type_id, coverage_package_id,
    delivery_deadline, special_instructions, notes, date_status, enquiry_source,
    created_by, venue_access_notes, venue_parking_notes
  )
  SELECT
    v_client_id, v_lead_id, v_event_name, c.business_name,
    COALESCE(v_event_date, CURRENT_DATE), v_start_time, v_end_time,
    v_venue_id, ve.name, ve.address_line_1,
    COALESCE(NULLIF(p_input #>> '{event_overrides,event_type_id}', '')::uuid, v_lead_record.event_type_id),
    NULLIF(p_input #>> '{event_overrides,coverage_package_id}', '')::uuid,
    NULLIF(p_input #>> '{event_overrides,delivery_deadline_at}', '')::timestamptz,
    COALESCE(NULLIF(p_input #>> '{event_overrides,special_instructions}', ''), v_lead_record.requirements_summary),
    v_lead_record.notes,
    COALESCE(NULLIF(p_input #>> '{event_overrides,date_status}', ''), 'confirmed'),
    v_lead_record.source, v_user_id, ve.access_notes, ve.parking_notes
  FROM public.clients c
  LEFT JOIN public.venues ve ON ve.id = v_venue_id
  WHERE c.id = v_client_id
  RETURNING id INTO v_event_id;

  IF COALESCE((p_input #>> '{options,copy_enquiry_contacts}')::boolean, true) THEN
    INSERT INTO public.event_contacts (
      event_id, client_contact_id, contact_type, contact_name, contact_email, contact_phone, notes
    )
    SELECT
      v_event_id, ec.contact_id,
      public.map_lead_role_to_event_contact_type(COALESCE(ec.role, 'primary')),
      COALESCE(ec.contact_name, cc.contact_name),
      COALESCE(ec.contact_email, cc.email),
      COALESCE(ec.contact_phone, cc.phone_mobile, cc.phone),
      ec.notes
    FROM public.enquiry_contacts ec
    LEFT JOIN public.client_contacts cc ON cc.id = ec.contact_id
    WHERE ec.lead_id = v_lead_id;
    GET DIAGNOSTICS v_contact_count = ROW_COUNT;
  END IF;

  UPDATE public.event_sessions
  SET event_id = v_event_id, lead_id = NULL, updated_at = NOW()
  WHERE lead_id = v_lead_id;
  GET DIAGNOSTICS v_session_count = ROW_COUNT;

  IF v_session_count = 0 AND v_event_date IS NOT NULL THEN
    INSERT INTO public.event_sessions (event_id, label, session_date, start_time, end_time)
    VALUES (v_event_id, 'Main Session', v_event_date, v_start_time, v_end_time);
    v_session_count := 1;
  END IF;

  INSERT INTO public.event_assignments (
    event_id, user_id, staff_role_id, session_id, assignment_notes, assignment_status, confirmation_status
  )
  SELECT
    v_event_id, la.user_id, la.staff_role_id,
    COALESCE(
      la.session_id,
      (SELECT es.id FROM public.event_sessions es WHERE es.event_id = v_event_id ORDER BY es.sort_order NULLS LAST, es.session_date LIMIT 1)
    ),
    la.assignment_notes,
    'assigned',
    COALESCE(la.confirmation_status, 'pending')
  FROM public.lead_assignments la
  WHERE la.lead_id = v_lead_id;

  v_workflow_result := public.initialize_all_operations_workflows(v_event_id);
  v_workflow_count := COALESCE((v_workflow_result->>'steps_created')::int, 0);
  IF NOT COALESCE((v_workflow_result->>'success')::boolean, false) THEN
    v_warnings := array_append(v_warnings, 'Failed to initialize workflows: ' || COALESCE(v_workflow_result->>'error', 'Unknown'));
  END IF;

  IF COALESCE((p_input #>> '{options,create_admin_setup_tasks}')::boolean, true) THEN
    INSERT INTO public.tasks (
      related_type, related_id, task_type, title, due_at, assigned_to, status, priority, created_by
    )
    VALUES
      ('event', v_event_id, 'prep', 'Review event brief', CASE WHEN v_event_date IS NOT NULL THEN (v_event_date::timestamp - INTERVAL '7 days') ELSE NULL END, v_user_id, 'open', 'normal', v_user_id),
      ('event', v_event_id, 'email', 'Send final confirmation email', CASE WHEN v_event_date IS NOT NULL THEN (v_event_date::timestamp - INTERVAL '3 days') ELSE NULL END, v_user_id, 'open', 'normal', v_user_id);
    GET DIAGNOSTICS v_task_count = ROW_COUNT;
  END IF;

  IF COALESCE((p_input #>> '{options,create_worksheets}')::boolean, true) THEN
    INSERT INTO public.event_worksheets (event_id, worksheet_type, status)
    VALUES
      (v_event_id, 'run_sheet', 'draft'),
      (v_event_id, 'shot_list', 'draft');
    GET DIAGNOSTICS v_ws_count = ROW_COUNT;
  END IF;

  UPDATE public.quotes SET event_id = v_event_id WHERE lead_id = v_lead_id AND event_id IS NULL;
  GET DIAGNOSTICS v_quote_count = ROW_COUNT;

  UPDATE public.contracts SET event_id = v_event_id WHERE lead_id = v_lead_id AND event_id IS NULL;
  GET DIAGNOSTICS v_contract_count = ROW_COUNT;

  UPDATE public.email_logs SET event_id = v_event_id WHERE lead_id = v_lead_id AND event_id IS NULL;

  UPDATE public.leads SET status = 'Won' WHERE id = v_lead_id;

  UPDATE public.clients
  SET manual_status = (SELECT cs.name FROM public.company_statuses cs WHERE cs.name = 'Active Event' LIMIT 1)
  WHERE id = v_client_id;

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
      'sessions', v_session_count,
      'workflow_steps', v_workflow_count,
      'quotes_linked', v_quote_count,
      'contracts_linked', v_contract_count
    ),
    'warnings', to_jsonb(v_warnings)
  );
END;
$$;