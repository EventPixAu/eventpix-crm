-- Add direct contact fields to enquiry_contacts (matching event_contacts pattern)
-- This allows leads to have contacts without requiring a client first

ALTER TABLE public.enquiry_contacts
  ALTER COLUMN contact_id DROP NOT NULL;

ALTER TABLE public.enquiry_contacts
  ADD COLUMN IF NOT EXISTS contact_name text,
  ADD COLUMN IF NOT EXISTS contact_email text,
  ADD COLUMN IF NOT EXISTS contact_phone text,
  ADD COLUMN IF NOT EXISTS notes text;

-- Add a check constraint to ensure either contact_id OR contact_name is provided
ALTER TABLE public.enquiry_contacts
  ADD CONSTRAINT enquiry_contacts_has_contact_info 
  CHECK (contact_id IS NOT NULL OR contact_name IS NOT NULL);

-- Update the unique constraint to allow direct contacts (only apply uniqueness when contact_id is set)
ALTER TABLE public.enquiry_contacts
  DROP CONSTRAINT IF EXISTS enquiry_contacts_lead_id_contact_id_key;

CREATE UNIQUE INDEX IF NOT EXISTS enquiry_contacts_lead_client_contact_unique 
  ON public.enquiry_contacts (lead_id, contact_id) 
  WHERE contact_id IS NOT NULL;

-- Update the convert_enquiry_to_event function to handle direct contacts
CREATE OR REPLACE FUNCTION public.convert_enquiry_to_event(p_lead_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  v_lead_record leads%ROWTYPE;
  v_event_id uuid;
  v_venue_id uuid;
  v_worksheet_count int := 0;
  v_task_count int := 0;
  v_contact_count int := 0;
  v_session_count int := 0;
  v_warnings text[] := '{}';
BEGIN
  -- 1) Load the lead
  SELECT * INTO v_lead_record FROM leads WHERE id = p_lead_id;
  
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Lead not found');
  END IF;

  -- 2) Possibly create venue from venue_text
  IF v_lead_record.venue_text IS NOT NULL AND v_lead_record.venue_text != '' THEN
    INSERT INTO venues (name, address)
    VALUES (v_lead_record.venue_text, v_lead_record.venue_text)
    RETURNING id INTO v_venue_id;
  END IF;

  -- 3) Create the event
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
    ops_status
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
    'pending'
  )
  RETURNING id INTO v_event_id;

  -- 4) Copy enquiry_contacts to event_contacts (handle both linked and direct contacts)
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

  -- 5) Transfer event sessions from lead to event
  UPDATE event_sessions
  SET 
    event_id = v_event_id,
    updated_at = NOW()
  WHERE lead_id = p_lead_id;

  GET DIAGNOSTICS v_session_count = ROW_COUNT;

  -- If sessions exist, use the first session's date as the primary event date
  IF v_session_count > 0 THEN
    UPDATE events
    SET 
      event_date = (SELECT session_date FROM event_sessions WHERE event_id = v_event_id ORDER BY session_date, sort_order LIMIT 1),
      start_time = (SELECT start_time FROM event_sessions WHERE event_id = v_event_id ORDER BY session_date, sort_order LIMIT 1),
      end_time = (SELECT end_time FROM event_sessions WHERE event_id = v_event_id ORDER BY session_date, sort_order LIMIT 1)
    WHERE id = v_event_id;
  END IF;

  -- 6) Create worksheets from workflow defaults
  INSERT INTO event_worksheets (event_id, template_id, status)
  SELECT
    v_event_id,
    etwd.template_id,
    'not_started'
  FROM event_type_workflow_defaults etwd
  WHERE etwd.event_type_id = v_lead_record.event_type_id;

  GET DIAGNOSTICS v_worksheet_count = ROW_COUNT;

  -- 7) Create tasks from workflow templates
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

  -- 8) Update lead status to accepted
  UPDATE leads 
  SET status = 'accepted', updated_at = NOW() 
  WHERE id = p_lead_id;

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
      'sessions', v_session_count
    ),
    'warnings', to_jsonb(v_warnings)
  );
END;
$$;