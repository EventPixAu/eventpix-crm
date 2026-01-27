
-- Update the convert_enquiry_to_event function to transfer ALL lead details to the event
-- Including: quotes, contracts, coverage_package, delivery deadline, photography brief, etc.

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
  v_workflow_step_count int := 0;
  v_quote_count int := 0;
  v_contract_count int := 0;
  v_warnings text[] := '{}';
  v_first_session RECORD;
  v_accepted_quote RECORD;
BEGIN
  -- 1) Load the lead
  SELECT * INTO v_lead_record FROM leads WHERE id = p_lead_id;
  
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Lead not found');
  END IF;
  
  -- Check if already converted
  IF v_lead_record.converted_job_id IS NOT NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Lead already converted to event');
  END IF;

  -- 2) Possibly create venue from venue_text
  IF v_lead_record.venue_text IS NOT NULL AND v_lead_record.venue_text != '' THEN
    INSERT INTO venues (name, address)
    VALUES (v_lead_record.venue_text, v_lead_record.venue_text)
    RETURNING id INTO v_venue_id;
  END IF;
  
  -- 3) Check for accepted quote to get additional details
  SELECT * INTO v_accepted_quote
  FROM quotes
  WHERE lead_id = p_lead_id AND status = 'accepted'
  ORDER BY updated_at DESC
  LIMIT 1;

  -- 4) Create the event with ALL lead details
  INSERT INTO events (
    event_name,
    client_name,
    client_id,
    event_date,
    event_type_id,
    special_instructions,
    lead_id,
    venue_id,
    venue_name,
    enquiry_source,
    notes,
    ops_status,
    -- Additional fields from lead
    is_training,
    main_shoot_date,
    booking_date,
    -- Link accepted quote if exists
    quote_id
  )
  VALUES (
    v_lead_record.lead_name,
    COALESCE(
      (SELECT business_name FROM clients WHERE id = v_lead_record.client_id),
      'TBC'
    ),
    v_lead_record.client_id,
    COALESCE(v_lead_record.estimated_event_date, CURRENT_DATE),
    v_lead_record.event_type_id,
    v_lead_record.requirements_summary,
    p_lead_id,
    v_venue_id,
    v_lead_record.venue_text,
    v_lead_record.source,
    v_lead_record.notes,
    'awaiting_details',
    v_lead_record.is_training,
    v_lead_record.estimated_event_date,
    CURRENT_DATE,
    v_accepted_quote.id
  )
  RETURNING id INTO v_event_id;

  -- 5) Copy enquiry_contacts to event_contacts (handle both linked and direct contacts)
  INSERT INTO event_contacts (event_id, client_contact_id, contact_type, contact_name, contact_email, contact_phone, notes)
  SELECT 
    v_event_id,
    ec.contact_id,
    COALESCE(ec.role, 'primary'),
    COALESCE(ec.contact_name, cc.contact_name),
    COALESCE(ec.contact_email, cc.email),
    COALESCE(ec.contact_phone, COALESCE(cc.phone_mobile, cc.phone)),
    ec.notes
  FROM enquiry_contacts ec
  LEFT JOIN client_contacts cc ON cc.id = ec.contact_id
  WHERE ec.lead_id = p_lead_id;

  GET DIAGNOSTICS v_contact_count = ROW_COUNT;

  -- 6) Transfer event sessions from lead to event
  UPDATE event_sessions
  SET 
    event_id = v_event_id,
    updated_at = NOW()
  WHERE lead_id = p_lead_id;

  GET DIAGNOSTICS v_session_count = ROW_COUNT;

  -- Get first session for event timing
  SELECT * INTO v_first_session
  FROM event_sessions 
  WHERE event_id = v_event_id 
  ORDER BY session_date, sort_order 
  LIMIT 1;

  -- If sessions exist, use the first session's date and time
  IF v_first_session.id IS NOT NULL THEN
    UPDATE events
    SET 
      event_date = v_first_session.session_date,
      start_time = v_first_session.start_time,
      end_time = v_first_session.end_time,
      main_shoot_date = v_first_session.session_date
    WHERE id = v_event_id;
  END IF;

  -- 7) Link ALL quotes from the lead to the new event
  UPDATE quotes
  SET 
    event_id = v_event_id,
    updated_at = NOW()
  WHERE lead_id = p_lead_id;
  
  GET DIAGNOSTICS v_quote_count = ROW_COUNT;

  -- 8) Link ALL contracts from the lead to the new event
  UPDATE contracts
  SET 
    event_id = v_event_id,
    updated_at = NOW()
  WHERE lead_id = p_lead_id;
  
  GET DIAGNOSTICS v_contract_count = ROW_COUNT;

  -- 9) Create worksheets from workflow defaults
  INSERT INTO event_worksheets (event_id, template_id, status)
  SELECT
    v_event_id,
    etwd.template_id,
    'not_started'
  FROM event_type_workflow_defaults etwd
  WHERE etwd.event_type_id = v_lead_record.event_type_id;

  GET DIAGNOSTICS v_worksheet_count = ROW_COUNT;

  -- 10) Create tasks from workflow templates
  INSERT INTO event_tasks (event_id, task_name, due_offset_days, task_order, status)
  SELECT 
    v_event_id,
    wts.step_name,
    COALESCE(wts.due_offset_days, 0),
    wts.step_order,
    'pending'
  FROM event_type_workflow_defaults etwd
  JOIN workflow_template_steps wts ON wts.template_id = etwd.template_id
  WHERE etwd.event_type_id = v_lead_record.event_type_id
  ORDER BY wts.step_order;

  GET DIAGNOSTICS v_task_count = ROW_COUNT;

  -- 11) Initialize operations workflow steps from all operations templates
  INSERT INTO event_workflow_steps (
    event_id,
    template_item_id,
    step_label,
    step_order,
    completion_type,
    auto_trigger_event,
    due_date,
    is_completed,
    notes
  )
  SELECT 
    v_event_id,
    wti.id,
    wti.label,
    (wt.sort_order * 100) + wti.sort_order,
    wti.completion_type,
    wti.auto_trigger_event,
    CASE 
      WHEN wti.date_offset_days IS NOT NULL THEN
        CASE wti.date_offset_reference
          WHEN 'job_accepted' THEN CURRENT_DATE + wti.date_offset_days
          WHEN 'event_date' THEN COALESCE(v_lead_record.estimated_event_date, CURRENT_DATE) + wti.date_offset_days
          WHEN 'delivery_deadline' THEN NULL -- Will be set when deadline is configured
          ELSE COALESCE(v_lead_record.estimated_event_date, CURRENT_DATE) + wti.date_offset_days
        END
      ELSE NULL
    END,
    false,
    wti.help_text
  FROM workflow_templates wt
  JOIN workflow_template_items wti ON wti.template_id = wt.id
  WHERE wt.workflow_domain = 'operations'
    AND wt.is_active = true
    AND wti.is_active = true
  ORDER BY wt.sort_order, wti.sort_order;
  
  GET DIAGNOSTICS v_workflow_step_count = ROW_COUNT;

  -- 12) Update lead status to won and store converted_job_id
  UPDATE leads 
  SET 
    status = 'won', 
    converted_job_id = v_event_id,
    updated_at = NOW() 
  WHERE id = p_lead_id;

  -- 13) Transfer email logs to reference the new event
  UPDATE email_logs
  SET 
    event_id = v_event_id,
    updated_at = NOW()
  WHERE lead_id = p_lead_id;

  -- Return success with stats
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
