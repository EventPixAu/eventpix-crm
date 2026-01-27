-- Update the initialize_event_workflow_steps function to handle job_accepted reference
CREATE OR REPLACE FUNCTION public.initialize_event_workflow_steps(p_event_id uuid, p_template_id uuid)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_event RECORD;
  v_item RECORD;
  v_due_date DATE;
  v_count INTEGER := 0;
  v_job_accepted_date DATE;
BEGIN
  -- Get event details for date calculations
  SELECT * INTO v_event FROM events WHERE id = p_event_id;
  
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Event not found';
  END IF;
  
  -- Calculate job_accepted date (when lead was converted or event was booked)
  -- First check if there's a linked lead with won status
  IF v_event.lead_id IS NOT NULL THEN
    SELECT (updated_at)::date INTO v_job_accepted_date
    FROM leads 
    WHERE id = v_event.lead_id AND status = 'won';
  END IF;
  
  -- Fallback to event created_at or booking_date
  v_job_accepted_date := COALESCE(v_job_accepted_date, v_event.booking_date::date, v_event.created_at::date, CURRENT_DATE);
  
  -- Delete existing workflow steps for this event (reset)
  DELETE FROM event_workflow_steps WHERE event_id = p_event_id;
  
  -- Insert steps from template
  FOR v_item IN 
    SELECT * FROM workflow_template_items 
    WHERE template_id = p_template_id 
      AND is_active = true
    ORDER BY sort_order
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
      v_item.sort_order,
      v_item.completion_type,
      v_item.auto_trigger_event,
      v_due_date,
      false,
      v_item.help_text
    );
    
    v_count := v_count + 1;
  END LOOP;
  
  -- Update event with workflow template reference
  UPDATE events SET workflow_template_id = p_template_id WHERE id = p_event_id;
  
  RETURN v_count;
END;
$function$;