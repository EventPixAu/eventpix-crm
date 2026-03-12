
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
  SELECT v_event_id, ec.contact_id, COALESCE(ec.role, 'primary'),
    COALESCE(ec.contact_name, cc.contact_name),
    COALESCE(ec.contact_email, cc.email),
    COALESCE(ec.contact_phone, COALESCE(cc.phone_mobile, cc.phone)),
    ec.notes
  FROM enquiry_contacts ec
  LEFT JOIN client_contacts cc ON cc.id = ec.contact_id
  WHERE ec.lead_id = p_lead_id;
  GET DIAGNOSTICS v_contact_count = ROW_COUNT;

  UPDATE event_sessions
  SET event_id = v_event_id, lead_id = NULL, updated_at = NOW()
  WHERE lead_id = p_lead_id;
  GET DIAGNOSTICS v_session_count = ROW_COUNT;

  SELECT * INTO v_first_session
  FROM event_sessions WHERE event_id = v_event_id ORDER BY session_date, sort_order LIMIT 1;

  IF v_first_session.id IS NOT NULL THEN
    UPDATE events
    SET event_date = v_first_session.session_date, start_time = v_first_session.start_time,
        end_time = v_first_session.end_time, main_shoot_date = v_first_session.session_date
    WHERE id = v_event_id;
  ELSE
    -- No sessions were transferred - auto-create one from the event's date/time data
    SELECT * INTO v_event_record FROM events WHERE id = v_event_id;
    IF v_event_record.event_date IS NOT NULL THEN
      INSERT INTO event_sessions (
        event_id, session_date, start_time, end_time,
        venue_name, venue_address, label, sort_order
      )
      VALUES (
        v_event_id,
        v_event_record.event_date,
        v_event_record.start_time,
        v_event_record.end_time,
        v_lead_record.venue_text,
        NULL,
        'Main Session',
        0
      );
      v_session_count := 1;
    END IF;
  END IF;

  INSERT INTO event_assignments (event_id, user_id, staff_role_id, role_on_event, session_id, confirmation_status, assignment_notes)
  SELECT v_event_id, la.user_id, la.staff_role_id, la.role_on_event, la.session_id,
    la.confirmation_status, la.assignment_notes
  FROM lead_assignments la
  WHERE la.lead_id = p_lead_id;
  GET DIAGNOSTICS v_assignment_count = ROW_COUNT;

  UPDATE quotes SET event_id = v_event_id, linked_event_id = v_event_id, updated_at = NOW()
  WHERE lead_id = p_lead_id;
  GET DIAGNOSTICS v_quote_count = ROW_COUNT;

  UPDATE contracts SET event_id = v_event_id, updated_at = NOW()
  WHERE lead_id = p_lead_id;
  GET DIAGNOSTICS v_contract_count = ROW_COUNT;

  UPDATE email_logs SET event_id = v_event_id, updated_at = NOW()
  WHERE lead_id = p_lead_id;

  UPDATE leads SET status = 'won', converted_job_id = v_event_id, updated_at = NOW()
  WHERE id = p_lead_id;

  PERFORM public.initialize_all_operations_workflows(v_event_id);

  IF v_lead_record.client_id IS NOT NULL THEN
    UPDATE clients SET status = 'active_event', updated_at = NOW()
    WHERE id = v_lead_record.client_id
      AND (status IS NULL OR status NOT IN ('active_event', 'supplier'));
    
    INSERT INTO company_status_audit (company_id, action, old_status, new_status, changed_by)
    SELECT v_lead_record.client_id, 'auto_update', status, 'active_event', NULL
    FROM clients WHERE id = v_lead_record.client_id;
  END IF;

  RETURN jsonb_build_object(
    'success', true, 'event_id', v_event_id,
    'contacts_copied', v_contact_count, 'sessions_transferred', v_session_count,
    'assignments_migrated', v_assignment_count, 'quotes_linked', v_quote_count,
    'contracts_linked', v_contract_count, 'warnings', v_warnings
  );
END;
$function$;

-- Backfill: create sessions for existing events that have date/time but no sessions
INSERT INTO event_sessions (event_id, session_date, start_time, end_time, venue_name, label, sort_order)
SELECT e.id, e.event_date, e.start_time, e.end_time, e.venue_name, 'Main Session', 0
FROM events e
WHERE e.event_date IS NOT NULL
  AND NOT EXISTS (SELECT 1 FROM event_sessions es WHERE es.event_id = e.id);
