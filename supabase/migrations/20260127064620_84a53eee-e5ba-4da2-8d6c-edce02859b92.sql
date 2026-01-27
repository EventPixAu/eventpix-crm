-- Create lead_type enum
CREATE TYPE public.lead_type AS ENUM ('new', 'existing', 'repeat');

-- Add lead_type column to leads table with manual override tracking
ALTER TABLE public.leads
ADD COLUMN lead_type public.lead_type DEFAULT NULL,
ADD COLUMN lead_type_auto boolean DEFAULT true,
ADD COLUMN lead_type_override_at timestamptz DEFAULT NULL,
ADD COLUMN lead_type_override_by uuid DEFAULT NULL REFERENCES auth.users(id);

-- Create function to auto-detect lead type based on client history
CREATE OR REPLACE FUNCTION public.detect_lead_type(p_client_id uuid)
RETURNS public.lead_type
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    CASE
      WHEN (SELECT COUNT(*) FROM events WHERE client_id = p_client_id) >= 2 THEN 'repeat'::public.lead_type
      WHEN (SELECT COUNT(*) FROM events WHERE client_id = p_client_id) = 1 THEN 'existing'::public.lead_type
      ELSE 'new'::public.lead_type
    END
$$;

-- Create trigger function to auto-set lead_type on insert/update
CREATE OR REPLACE FUNCTION public.auto_set_lead_type()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Only auto-set if lead_type_auto is true and client_id is set
  IF NEW.lead_type_auto = true AND NEW.client_id IS NOT NULL THEN
    NEW.lead_type := public.detect_lead_type(NEW.client_id);
  END IF;
  
  -- If manually overriding, update override tracking
  IF NEW.lead_type IS DISTINCT FROM OLD.lead_type AND NEW.lead_type_auto = false THEN
    NEW.lead_type_override_at := NOW();
    NEW.lead_type_override_by := auth.uid();
  END IF;
  
  RETURN NEW;
END;
$$;

-- Create trigger for auto-setting lead type
CREATE TRIGGER trg_auto_set_lead_type
  BEFORE INSERT OR UPDATE OF client_id, lead_type, lead_type_auto
  ON public.leads
  FOR EACH ROW
  EXECUTE FUNCTION public.auto_set_lead_type();

-- Create function to initialize all operations workflow steps for an event
CREATE OR REPLACE FUNCTION public.initialize_all_operations_workflows(p_event_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_event RECORD;
  v_item RECORD;
  v_due_date DATE;
  v_count INTEGER := 0;
  v_job_accepted_date DATE;
  v_template_ids uuid[];
BEGIN
  -- Get event details for date calculations
  SELECT * INTO v_event FROM events WHERE id = p_event_id;
  
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Event not found');
  END IF;
  
  -- Calculate job_accepted date (when lead was converted or event was booked)
  IF v_event.lead_id IS NOT NULL THEN
    SELECT (updated_at)::date INTO v_job_accepted_date
    FROM leads 
    WHERE id = v_event.lead_id AND status = 'won';
  END IF;
  
  v_job_accepted_date := COALESCE(v_job_accepted_date, v_event.booking_date::date, v_event.created_at::date, CURRENT_DATE);
  
  -- Delete existing workflow steps for this event (reset)
  DELETE FROM event_workflow_steps WHERE event_id = p_event_id;
  
  -- Get all active operations workflow templates
  SELECT array_agg(id) INTO v_template_ids
  FROM workflow_templates
  WHERE workflow_domain = 'operations'
    AND is_active = true;
  
  IF v_template_ids IS NULL OR array_length(v_template_ids, 1) = 0 THEN
    RETURN jsonb_build_object('success', true, 'steps_created', 0, 'message', 'No operations workflows found');
  END IF;
  
  -- Insert steps from all operations templates
  FOR v_item IN 
    SELECT wti.*, wt.template_name, wt.phase
    FROM workflow_template_items wti
    JOIN workflow_templates wt ON wt.id = wti.template_id
    WHERE wt.id = ANY(v_template_ids)
      AND wti.is_active = true
    ORDER BY 
      CASE wt.phase
        WHEN 'pre_event' THEN 1
        WHEN 'day_of' THEN 2
        WHEN 'post_event' THEN 3
        ELSE 4
      END,
      wt.template_name,
      wti.sort_order
  LOOP
    -- Calculate due date based on offset
    v_due_date := NULL;
    IF v_item.date_offset_days IS NOT NULL THEN
      CASE v_item.date_offset_reference
        WHEN 'job_accepted' THEN
          v_due_date := v_job_accepted_date + v_item.date_offset_days;
        WHEN 'event_date' THEN
          v_due_date := (COALESCE(v_event.main_shoot_date, v_event.event_date)::DATE + v_item.date_offset_days);
        WHEN 'booking_date' THEN
          v_due_date := (COALESCE(v_event.booking_date, v_event.created_at)::DATE + v_item.date_offset_days);
        WHEN 'delivery_deadline' THEN
          IF v_event.delivery_deadline IS NOT NULL THEN
            v_due_date := (v_event.delivery_deadline::DATE + v_item.date_offset_days);
          END IF;
        ELSE
          v_due_date := (COALESCE(v_event.main_shoot_date, v_event.event_date)::DATE + v_item.date_offset_days);
      END CASE;
    END IF;
    
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
    ) VALUES (
      p_event_id,
      v_item.id,
      v_item.label,
      v_count + 1, -- Sequential order across all templates
      v_item.completion_type,
      v_item.auto_trigger_event,
      v_due_date,
      false,
      v_item.help_text
    );
    
    v_count := v_count + 1;
  END LOOP;
  
  RETURN jsonb_build_object(
    'success', true,
    'steps_created', v_count,
    'templates_used', array_length(v_template_ids, 1)
  );
END;
$$;

-- Update the convert_enquiry_to_event function to auto-initialize operations workflows
CREATE OR REPLACE FUNCTION public.convert_enquiry_to_event(p_input jsonb)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
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
  v_workflow_count int := 0;
  v_event_name text;
  v_event_date date;
  v_start_time time;
  v_end_time time;
  v_lead_record RECORD;
  v_first_session RECORD;
  v_workflow_result jsonb;
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

  -- 9) AUTO-INITIALIZE ALL OPERATIONS WORKFLOWS
  v_workflow_result := public.initialize_all_operations_workflows(v_event_id);
  v_workflow_count := COALESCE((v_workflow_result->>'steps_created')::int, 0);
  
  IF NOT COALESCE((v_workflow_result->>'success')::boolean, false) THEN
    v_warnings := array_append(v_warnings, 'Failed to initialize workflows: ' || COALESCE(v_workflow_result->>'error', 'Unknown'));
  END IF;

  -- 10) Create default admin setup tasks (skip if explicitly disabled)
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
    jsonb_build_object('event_id', v_event_id, 'venue_created', v_created_venue, 'sessions_transferred', v_session_count, 'workflow_steps', v_workflow_count)
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
      'sessions', v_session_count,
      'workflow_steps', v_workflow_count
    ),
    'warnings', v_warnings
  );

EXCEPTION WHEN OTHERS THEN
  RETURN jsonb_build_object('success', false, 'error', SQLERRM);
END;
$$;