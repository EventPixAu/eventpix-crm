
-- Update UUID variant: map lead contact roles to valid event contact types
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
  v_event_record RECORD;
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
  FROM quotes
  WHERE lead_id = p_lead_id AND status = 'accepted'
  ORDER BY updated_at DESC
  LIMIT 1;

  INSERT INTO events (
    event_name, client_name, client_id, event_date, event_type_id,
    special_instructions, lead_id, venue_id, venue_name, enquiry_source,
    notes, ops_status, is_training, main_shoot_date, booking_date, quote_id
  )
  VALUES (
    v_lead_record.lead_name,
    COALESCE((SELECT business_name FROM clients WHERE id = v_lead_record.client_id), 'TBC'),
    v_lead_record.client_id,
    COALESCE(v_lead_record.estimated_event_date, CURRENT_DATE),
    v_lead_record.event_type_id,
    v_lead_record.requirements_summary,
    p_lead_id, v_venue_id, v_lead_record.venue_text, v_lead_record.source,
    v_lead_record.notes, 'awaiting_details', v_lead_record.is_training,
    v_lead_record.estimated_event_date, CURRENT_DATE, v_accepted_quote.id
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

  -- Copy lead sessions to event sessions
  INSERT INTO event_sessions (event_id, session_label, session_date, start_time, end_time, venue_id, notes, sort_order)
  SELECT v_event_id, ls.session_label, ls.session_date, ls.start_time, ls.end_time, 
    COALESCE(ls.venue_id, v_venue_id), ls.notes, ls.sort_order
  FROM lead_sessions ls
  WHERE ls.lead_id = p_lead_id;
  GET DIAGNOSTICS v_session_count = ROW_COUNT;

  -- If no sessions exist, create a default one
  IF v_session_count = 0 AND v_lead_record.estimated_event_date IS NOT NULL THEN
    INSERT INTO event_sessions (event_id, session_label, session_date, start_time, end_time, venue_id)
    VALUES (v_event_id, 'Main Session', v_lead_record.estimated_event_date, 
      v_lead_record.start_time, v_lead_record.end_time, v_venue_id);
    v_session_count := 1;
  END IF;

  -- Copy lead assignments
  INSERT INTO event_assignments (event_id, user_id, role_id, session_id, status, notes)
  SELECT v_event_id, la.user_id, la.role_id,
    (SELECT es.id FROM event_sessions es WHERE es.event_id = v_event_id ORDER BY es.sort_order LIMIT 1),
    'confirmed', la.notes
  FROM lead_assignments la
  WHERE la.lead_id = p_lead_id;
  GET DIAGNOSTICS v_assignment_count = ROW_COUNT;

  -- Link quotes
  UPDATE quotes SET event_id = v_event_id WHERE lead_id = p_lead_id;
  GET DIAGNOSTICS v_quote_count = ROW_COUNT;

  -- Link contracts
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

  -- Set first session times on event
  SELECT * INTO v_first_session FROM event_sessions WHERE event_id = v_event_id ORDER BY sort_order LIMIT 1;
  IF FOUND THEN
    UPDATE events SET start_time = v_first_session.start_time, end_time = v_first_session.end_time WHERE id = v_event_id;
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
