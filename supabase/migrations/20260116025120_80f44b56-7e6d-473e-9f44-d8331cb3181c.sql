-- Drop the old function
DROP FUNCTION IF EXISTS public.convert_enquiry_to_event(uuid, text, date, time, time, uuid, text, text, date, uuid, text, text);

-- Create the new JSONB-based function matching the contract
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
  v_event_name text;
  v_event_date date;
  v_start_time time;
  v_end_time time;
  v_lead_record RECORD;
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
  
  -- Handle date/time - support both start_at (timestamptz) and separate date/time
  IF (p_input #>> '{event_overrides,start_at}') IS NOT NULL AND (p_input #>> '{event_overrides,start_at}') <> '' THEN
    v_event_date := ((p_input #>> '{event_overrides,start_at}')::timestamptz)::date;
    v_start_time := ((p_input #>> '{event_overrides,start_at}')::timestamptz)::time;
  ELSIF (p_input #>> '{event_overrides,event_date}') IS NOT NULL AND (p_input #>> '{event_overrides,event_date}') <> '' THEN
    v_event_date := (p_input #>> '{event_overrides,event_date}')::date;
    v_start_time := NULLIF(p_input #>> '{event_overrides,start_time}', '')::time;
  ELSE
    v_event_date := v_lead_record.estimated_event_date;
    v_start_time := NULL;
  END IF;

  IF (p_input #>> '{event_overrides,end_at}') IS NOT NULL AND (p_input #>> '{event_overrides,end_at}') <> '' THEN
    v_end_time := ((p_input #>> '{event_overrides,end_at}')::timestamptz)::time;
  ELSIF (p_input #>> '{event_overrides,end_time}') IS NOT NULL AND (p_input #>> '{event_overrides,end_time}') <> '' THEN
    v_end_time := (p_input #>> '{event_overrides,end_time}')::time;
  ELSE
    v_end_time := NULL;
  END IF;

  -- Require event_date
  IF v_event_date IS NULL THEN
    v_warnings := array_append(v_warnings, 'Event date is TBC');
  END IF;

  -- 7) Create event
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
    date_status,
    enquiry_source,
    ops_status
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
    ven.name,
    ven.address,
    COALESCE(NULLIF(p_input #>> '{event_overrides,event_type_id}', '')::uuid, v_lead_record.event_type_id),
    NULLIF(p_input #>> '{event_overrides,coverage_package_id}', '')::uuid,
    NULLIF(p_input #>> '{event_overrides,delivery_deadline_at}', '')::date,
    COALESCE(NULLIF(p_input #>> '{event_overrides,special_instructions}', ''), v_lead_record.requirements_summary),
    CASE WHEN v_event_date IS NULL THEN 'tbc' ELSE COALESCE(p_input #>> '{event_overrides,date_status}', 'confirmed') END,
    v_lead_record.source,
    'awaiting_details'
  FROM clients c
  LEFT JOIN venues ven ON ven.id = v_venue_id
  WHERE c.id = v_client_id
  RETURNING id INTO v_event_id;

  -- 8) Copy contacts (optional)
  IF COALESCE((p_input #>> '{options,copy_enquiry_contacts}')::boolean, true) THEN
    INSERT INTO event_contacts(event_id, client_contact_id, contact_type, contact_name, contact_email, contact_phone)
    SELECT 
      v_event_id, 
      ec.contact_id, 
      COALESCE(ec.role, 'primary'),
      cc.contact_name,
      cc.email,
      cc.phone
    FROM enquiry_contacts ec
    JOIN client_contacts cc ON cc.id = ec.contact_id
    WHERE ec.lead_id = v_lead_id;

    GET DIAGNOSTICS v_contact_count = ROW_COUNT;

    IF v_contact_count = 0 THEN
      v_warnings := array_append(v_warnings, 'No contacts were linked');
    END IF;
  END IF;

  -- 9) Worksheets (optional)
  IF COALESCE((p_input #>> '{options,create_worksheets}')::boolean, true) THEN
    SELECT array_agg((x)::uuid) INTO v_templates
    FROM jsonb_array_elements_text(COALESCE(p_input #> '{workflow_pack,template_ids}', '[]'::jsonb)) AS x;

    IF v_templates IS NOT NULL AND array_length(v_templates, 1) > 0 THEN
      INSERT INTO worksheets(event_id, template_id, status)
      SELECT v_event_id, t, 'pending'
      FROM unnest(v_templates) AS t
      WHERE EXISTS (SELECT 1 FROM workflow_templates wt WHERE wt.id = t);

      GET DIAGNOSTICS v_ws_count = ROW_COUNT;
    ELSE
      v_warnings := array_append(v_warnings, 'No workflow templates selected');
    END IF;
  END IF;

  -- 10) Admin setup tasks (optional)
  IF COALESCE((p_input #>> '{options,create_admin_setup_tasks}')::boolean, true) THEN
    INSERT INTO tasks(related_type, related_id, task_type, title, due_at, status, notes)
    VALUES
      ('event', v_event_id, 'setup', 'Assign lead photographer', NOW() + interval '1 day', 'open', 'Assign lead photographer for this event'),
      ('event', v_event_id, 'setup', 'Confirm run sheet and contacts', NOW() + interval '2 days', 'open', 'Confirm run sheet and on-site contacts'),
      ('event', v_event_id, 'setup', 'Confirm delivery method and deadline', NOW() + interval '2 days', 'open', 'Confirm delivery method and deadline with client');

    GET DIAGNOSTICS v_task_count = ROW_COUNT;
  END IF;

  -- 11) Update lead status
  UPDATE leads
  SET status = 'won', updated_at = NOW()
  WHERE id = v_lead_id;

  -- 12) Audit log
  INSERT INTO audit_log(actor_user_id, action, event_id, before, after)
  VALUES (
    v_user_id,
    'event_created_from_enquiry',
    v_event_id,
    jsonb_build_object('lead_id', v_lead_id),
    jsonb_build_object(
      'created_venue', v_created_venue,
      'worksheets', v_ws_count,
      'tasks', v_task_count,
      'contacts', v_contact_count,
      'warnings', v_warnings
    )
  );

  RETURN jsonb_build_object(
    'success', true,
    'event_id', v_event_id,
    'venue_id', v_venue_id,
    'created', jsonb_build_object(
      'event', true,
      'venue', v_created_venue,
      'worksheets', v_ws_count,
      'tasks', v_task_count,
      'event_contacts', v_contact_count
    ),
    'warnings', to_jsonb(v_warnings)
  );

EXCEPTION
  WHEN others THEN
    RETURN jsonb_build_object('success', false, 'error', SQLERRM);
END;
$$;