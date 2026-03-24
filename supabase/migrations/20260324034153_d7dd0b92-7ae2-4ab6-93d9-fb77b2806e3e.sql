
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

  -- Create venue from text if provided
  IF v_lead_record.venue_text IS NOT NULL AND v_lead_record.venue_text != '' THEN
    INSERT INTO venues (name, address_line_1)
    VALUES (v_lead_record.venue_text, v_lead_record.venue_text)
    RETURNING id INTO v_venue_id;
  END IF;

  -- Find accepted quote
  SELECT * INTO v_accepted_quote
  FROM quotes WHERE lead_id = p_lead_id AND status = 'accepted'
  ORDER BY updated_at DESC LIMIT 1;

  -- Get first session for date/time
  SELECT * INTO v_first_session
  FROM event_sessions WHERE lead_id = p_lead_id
  ORDER BY session_date, sort_order NULLS LAST LIMIT 1;

  -- Create event
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

  -- Copy contacts with role mapping
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

  -- Transfer sessions from lead to event
  UPDATE event_sessions SET event_id = v_event_id, updated_at = NOW() WHERE lead_id = p_lead_id;
  GET DIAGNOSTICS v_session_count = ROW_COUNT;

  -- If no sessions, create a default one
  IF v_session_count = 0 AND v_lead_record.estimated_event_date IS NOT NULL THEN
    INSERT INTO event_sessions (event_id, label, session_date)
    VALUES (v_event_id, 'Main Session', v_lead_record.estimated_event_date);
    v_session_count := 1;
  END IF;

  -- Copy lead assignments
  INSERT INTO event_assignments (event_id, user_id, staff_role_id, session_id, status, assignment_notes)
  SELECT v_event_id, la.user_id, la.staff_role_id,
    (SELECT es.id FROM event_sessions es WHERE es.event_id = v_event_id ORDER BY es.sort_order LIMIT 1),
    'confirmed', la.assignment_notes
  FROM lead_assignments la
  WHERE la.lead_id = p_lead_id;
  GET DIAGNOSTICS v_assignment_count = ROW_COUNT;

  -- Link quotes and contracts
  UPDATE quotes SET event_id = v_event_id WHERE lead_id = p_lead_id;
  GET DIAGNOSTICS v_quote_count = ROW_COUNT;
  UPDATE contracts SET event_id = v_event_id WHERE lead_id = p_lead_id;
  GET DIAGNOSTICS v_contract_count = ROW_COUNT;

  -- Link email logs
  UPDATE email_logs SET event_id = v_event_id WHERE lead_id = p_lead_id AND event_id IS NULL;

  -- Update lead
  UPDATE leads SET converted_job_id = v_event_id, status = 'won' WHERE id = p_lead_id;

  -- Update company status
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
