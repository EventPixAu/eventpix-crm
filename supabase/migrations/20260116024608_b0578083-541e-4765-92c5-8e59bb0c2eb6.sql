-- =============================================
-- ENQUIRY → EVENT HANDOFF FLOW
-- =============================================

-- 1. Add date_status field to events
ALTER TABLE public.events
  ADD COLUMN IF NOT EXISTS date_status text DEFAULT 'confirmed' CHECK (date_status IN ('confirmed', 'tbc', 'tentative'));

-- 2. Add source tracking to events
ALTER TABLE public.events
  ADD COLUMN IF NOT EXISTS enquiry_source text;

-- 3. Add new audit actions for handoff
DO $$
BEGIN
  -- Add new enum values if they don't exist
  IF NOT EXISTS (SELECT 1 FROM pg_enum WHERE enumlabel = 'enquiry_won' AND enumtypid = 'audit_action'::regtype) THEN
    ALTER TYPE audit_action ADD VALUE 'enquiry_won';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_enum WHERE enumlabel = 'event_created_from_enquiry' AND enumtypid = 'audit_action'::regtype) THEN
    ALTER TYPE audit_action ADD VALUE 'event_created_from_enquiry';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_enum WHERE enumlabel = 'workflow_pack_applied' AND enumtypid = 'audit_action'::regtype) THEN
    ALTER TYPE audit_action ADD VALUE 'workflow_pack_applied';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_enum WHERE enumlabel = 'tasks_created' AND enumtypid = 'audit_action'::regtype) THEN
    ALTER TYPE audit_action ADD VALUE 'tasks_created';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_enum WHERE enumlabel = 'venue_created_or_linked' AND enumtypid = 'audit_action'::regtype) THEN
    ALTER TYPE audit_action ADD VALUE 'venue_created_or_linked';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_enum WHERE enumlabel = 'event_cancelled' AND enumtypid = 'audit_action'::regtype) THEN
    ALTER TYPE audit_action ADD VALUE 'event_cancelled';
  END IF;
END$$;

-- 4. Create the atomic handoff RPC function
CREATE OR REPLACE FUNCTION public.convert_enquiry_to_event(
  p_lead_id uuid,
  p_event_name text,
  p_event_date date DEFAULT NULL,
  p_start_time time DEFAULT NULL,
  p_end_time time DEFAULT NULL,
  p_venue_id uuid DEFAULT NULL,
  p_venue_name text DEFAULT NULL,
  p_venue_address text DEFAULT NULL,
  p_delivery_deadline date DEFAULT NULL,
  p_coverage_package_id uuid DEFAULT NULL,
  p_special_instructions text DEFAULT NULL,
  p_date_status text DEFAULT 'confirmed'
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_lead leads%ROWTYPE;
  v_event_id uuid;
  v_existing_event_id uuid;
  v_client_id uuid;
  v_client_name text;
  v_actor_id uuid;
  v_venue_id uuid;
  v_start_at timestamptz;
  v_end_at timestamptz;
  v_task_ids uuid[];
  v_task_id uuid;
BEGIN
  -- Get actor
  v_actor_id := auth.uid();
  
  -- Check permissions
  IF NOT can_access_sales(v_actor_id) THEN
    RETURN jsonb_build_object('success', false, 'error', 'Access denied');
  END IF;
  
  -- Get lead details
  SELECT * INTO v_lead FROM leads WHERE id = p_lead_id;
  
  IF v_lead IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Lead not found');
  END IF;
  
  -- Check if already converted
  SELECT id INTO v_existing_event_id FROM events WHERE lead_id = p_lead_id LIMIT 1;
  
  IF v_existing_event_id IS NOT NULL THEN
    RETURN jsonb_build_object(
      'success', false, 
      'error', 'Lead already converted to event',
      'event_id', v_existing_event_id
    );
  END IF;
  
  -- Check lead status allows conversion
  IF v_lead.status IN ('accepted', 'lost') THEN
    RETURN jsonb_build_object('success', false, 'error', 'Lead status does not allow conversion');
  END IF;
  
  -- Get client info
  v_client_id := v_lead.client_id;
  IF v_client_id IS NOT NULL THEN
    SELECT business_name INTO v_client_name FROM clients WHERE id = v_client_id;
  ELSE
    v_client_name := 'Unknown Client';
  END IF;
  
  -- Handle venue creation/linking
  v_venue_id := p_venue_id;
  IF v_venue_id IS NULL AND p_venue_name IS NOT NULL THEN
    -- Create new venue
    INSERT INTO venues (name, address_line_1)
    VALUES (p_venue_name, p_venue_address)
    RETURNING id INTO v_venue_id;
    
    -- Audit venue creation
    INSERT INTO audit_log (actor_user_id, action, after)
    VALUES (v_actor_id, 'venue_created_or_linked', jsonb_build_object(
      'venue_id', v_venue_id,
      'venue_name', p_venue_name,
      'created_new', true
    ));
  END IF;
  
  -- Calculate start_at and end_at timestamps
  IF p_event_date IS NOT NULL THEN
    v_start_at := (p_event_date + COALESCE(p_start_time, '09:00'::time))::timestamptz;
    v_end_at := (p_event_date + COALESCE(p_end_time, '17:00'::time))::timestamptz;
  END IF;
  
  -- Create the event
  INSERT INTO events (
    event_name,
    client_id,
    client_name,
    lead_id,
    event_date,
    start_at,
    end_at,
    start_time,
    end_time,
    venue_id,
    venue_name,
    venue_address,
    delivery_deadline,
    coverage_package_id,
    special_instructions,
    date_status,
    enquiry_source,
    ops_status,
    created_by
  )
  VALUES (
    p_event_name,
    v_client_id,
    v_client_name,
    p_lead_id,
    p_event_date,
    v_start_at,
    v_end_at,
    p_start_time,
    p_end_time,
    v_venue_id,
    COALESCE((SELECT name FROM venues WHERE id = v_venue_id), p_venue_name),
    COALESCE((SELECT address_line_1 FROM venues WHERE id = v_venue_id), p_venue_address),
    p_delivery_deadline,
    p_coverage_package_id,
    COALESCE(p_special_instructions, v_lead.requirements_summary),
    p_date_status,
    v_lead.source,
    'awaiting_details',
    v_actor_id
  )
  RETURNING id INTO v_event_id;
  
  -- Update lead status to won/accepted
  UPDATE leads 
  SET status = 'accepted', updated_at = now()
  WHERE id = p_lead_id;
  
  -- Copy enquiry contacts to event contacts
  INSERT INTO event_contacts (event_id, client_contact_id, contact_type)
  SELECT v_event_id, ec.contact_id, 'primary'
  FROM enquiry_contacts ec
  WHERE ec.lead_id = p_lead_id;
  
  -- Create setup tasks
  v_task_ids := ARRAY[]::uuid[];
  
  -- Task: Confirm venue and run sheet
  IF v_venue_id IS NULL OR p_event_date IS NULL THEN
    INSERT INTO tasks (
      related_type, related_id, task_type, title, description,
      due_at, assigned_to, priority, created_by
    )
    VALUES (
      'event', v_event_id, 'prep', 'Confirm venue and run sheet',
      'Confirm venue details and obtain run sheet for the event.',
      COALESCE(v_start_at - interval '7 days', now() + interval '3 days'),
      v_actor_id, 'high', v_actor_id
    )
    RETURNING id INTO v_task_id;
    v_task_ids := array_append(v_task_ids, v_task_id);
  END IF;
  
  -- Task: Assign lead photographer
  INSERT INTO tasks (
    related_type, related_id, task_type, title, description,
    due_at, assigned_to, priority, created_by
  )
  VALUES (
    'event', v_event_id, 'prep', 'Assign lead photographer',
    'Select and assign the lead photographer for this event.',
    COALESCE(v_start_at - interval '14 days', now() + interval '5 days'),
    v_actor_id, 'high', v_actor_id
  )
  RETURNING id INTO v_task_id;
  v_task_ids := array_append(v_task_ids, v_task_id);
  
  -- Task: Confirm delivery method
  INSERT INTO tasks (
    related_type, related_id, task_type, title, description,
    due_at, assigned_to, priority, created_by
  )
  VALUES (
    'event', v_event_id, 'prep', 'Confirm delivery method and deadline',
    'Set up delivery method and confirm deadline with client.',
    COALESCE(v_start_at - interval '5 days', now() + interval '2 days'),
    v_actor_id, 'normal', v_actor_id
  )
  RETURNING id INTO v_task_id;
  v_task_ids := array_append(v_task_ids, v_task_id);
  
  -- Task: Date TBC reminder
  IF p_date_status = 'tbc' THEN
    INSERT INTO tasks (
      related_type, related_id, task_type, title, description,
      due_at, assigned_to, priority, created_by
    )
    VALUES (
      'event', v_event_id, 'follow_up', 'Confirm event date with client',
      'Event date is TBC - follow up with client to confirm.',
      now() + interval '3 days',
      v_actor_id, 'urgent', v_actor_id
    )
    RETURNING id INTO v_task_id;
    v_task_ids := array_append(v_task_ids, v_task_id);
  END IF;
  
  -- Audit: Enquiry won
  INSERT INTO audit_log (actor_user_id, action, before, after)
  VALUES (v_actor_id, 'enquiry_won', 
    jsonb_build_object('lead_id', p_lead_id, 'previous_status', v_lead.status),
    jsonb_build_object('lead_id', p_lead_id, 'new_status', 'accepted')
  );
  
  -- Audit: Event created from enquiry
  INSERT INTO audit_log (actor_user_id, event_id, action, after)
  VALUES (v_actor_id, v_event_id, 'event_created_from_enquiry', jsonb_build_object(
    'lead_id', p_lead_id,
    'event_id', v_event_id,
    'event_name', p_event_name,
    'client_id', v_client_id,
    'venue_id', v_venue_id,
    'date_status', p_date_status
  ));
  
  -- Audit: Tasks created
  IF array_length(v_task_ids, 1) > 0 THEN
    INSERT INTO audit_log (actor_user_id, event_id, action, after)
    VALUES (v_actor_id, v_event_id, 'tasks_created', jsonb_build_object(
      'task_count', array_length(v_task_ids, 1),
      'task_ids', v_task_ids
    ));
  END IF;
  
  -- Create notification for admin
  PERFORM create_notification(
    v_actor_id,
    'event_created',
    'Event Created',
    'Event "' || p_event_name || '" has been created from enquiry. Complete the setup checklist.',
    'event',
    v_event_id,
    'info'
  );
  
  RETURN jsonb_build_object(
    'success', true,
    'event_id', v_event_id,
    'tasks_created', array_length(v_task_ids, 1),
    'venue_created', (v_venue_id IS NOT NULL AND p_venue_id IS NULL)
  );
END;
$$;

-- 5. Function to update rebooking profile when event completes
CREATE OR REPLACE FUNCTION public.update_rebooking_on_event_complete()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_client_id uuid;
  v_typical_month integer;
  v_lead_time_days integer;
  v_next_expected date;
BEGIN
  -- Only trigger when status changes to completed
  IF NEW.ops_status = 'completed' AND OLD.ops_status != 'completed' THEN
    v_client_id := NEW.client_id;
    
    IF v_client_id IS NOT NULL THEN
      -- Get or calculate typical month from event date
      v_typical_month := EXTRACT(MONTH FROM NEW.event_date);
      
      -- Get existing profile or use defaults
      SELECT typical_lead_time_days INTO v_lead_time_days
      FROM rebooking_profiles WHERE client_id = v_client_id;
      
      v_lead_time_days := COALESCE(v_lead_time_days, 60);
      
      -- Calculate next expected event (same month next year, minus lead time for reminder)
      v_next_expected := make_date(
        EXTRACT(YEAR FROM NEW.event_date)::integer + 1,
        v_typical_month,
        15
      );
      
      -- Upsert rebooking profile
      INSERT INTO rebooking_profiles (
        client_id, 
        typical_event_month, 
        typical_lead_time_days,
        last_event_at, 
        next_expected_event_at
      )
      VALUES (
        v_client_id,
        v_typical_month,
        v_lead_time_days,
        NEW.end_at,
        v_next_expected
      )
      ON CONFLICT (client_id) DO UPDATE SET
        last_event_at = NEW.end_at,
        next_expected_event_at = v_next_expected,
        typical_event_month = COALESCE(rebooking_profiles.typical_event_month, v_typical_month),
        updated_at = now();
      
      -- Create future follow-up task
      INSERT INTO tasks (
        related_type, related_id, task_type, title, description,
        due_at, priority, created_by
      )
      VALUES (
        'client', v_client_id, 'follow_up', 
        'Annual rebook: ' || NEW.client_name,
        'Follow up for annual rebooking. Previous event: ' || NEW.event_name,
        v_next_expected - (v_lead_time_days || ' days')::interval,
        'normal',
        auth.uid()
      );
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$;

-- Create trigger for rebooking automation
DROP TRIGGER IF EXISTS trigger_update_rebooking_on_complete ON events;
CREATE TRIGGER trigger_update_rebooking_on_complete
  AFTER UPDATE ON events
  FOR EACH ROW
  EXECUTE FUNCTION update_rebooking_on_event_complete();

-- 6. Grant execute permission on the RPC
GRANT EXECUTE ON FUNCTION public.convert_enquiry_to_event TO authenticated;