
CREATE OR REPLACE FUNCTION public.initialize_all_operations_workflows(p_event_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  v_event RECORD;
  v_step RECORD;
  v_due_date DATE;
  v_count INTEGER := 0;
  v_job_accepted_date DATE;
  v_has_defaults boolean := false;
BEGIN
  -- Get event details for date calculations
  SELECT * INTO v_event FROM events WHERE id = p_event_id;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Event not found');
  END IF;

  -- Calculate job_accepted date
  IF v_event.lead_id IS NOT NULL THEN
    SELECT (updated_at)::date INTO v_job_accepted_date
    FROM leads
    WHERE id = v_event.lead_id AND status = 'won';
  END IF;
  v_job_accepted_date := COALESCE(v_job_accepted_date, v_event.booking_date::date, v_event.created_at::date, CURRENT_DATE);

  -- Reset existing steps
  DELETE FROM event_workflow_steps WHERE event_id = p_event_id;

  -- Determine if this event_type has configured defaults
  IF v_event.event_type_id IS NOT NULL THEN
    SELECT EXISTS (
      SELECT 1 FROM event_type_step_defaults d
      JOIN workflow_master_steps s ON s.id = d.master_step_id
      WHERE d.event_type_id = v_event.event_type_id
        AND s.is_active = true
    ) INTO v_has_defaults;
  END IF;

  -- Insert steps from master steps, scoped to the event type defaults if any
  FOR v_step IN
    SELECT s.*
    FROM workflow_master_steps s
    WHERE s.is_active = true
      AND (
        NOT v_has_defaults
        OR EXISTS (
          SELECT 1 FROM event_type_step_defaults d
          WHERE d.master_step_id = s.id
            AND d.event_type_id = v_event.event_type_id
        )
      )
    ORDER BY
      CASE s.phase
        WHEN 'pre_event' THEN 1
        WHEN 'day_of' THEN 2
        WHEN 'post_event' THEN 3
        ELSE 4
      END,
      s.sort_order
  LOOP
    v_due_date := NULL;
    IF v_step.date_offset_days IS NOT NULL THEN
      CASE v_step.date_offset_reference
        WHEN 'job_accepted' THEN
          v_due_date := v_job_accepted_date + v_step.date_offset_days;
        WHEN 'event_date' THEN
          v_due_date := (COALESCE(v_event.main_shoot_date, v_event.event_date)::DATE + v_step.date_offset_days);
        WHEN 'delivery_deadline' THEN
          IF v_event.delivery_deadline IS NOT NULL THEN
            v_due_date := (v_event.delivery_deadline::DATE + v_step.date_offset_days);
          END IF;
        WHEN 'lead_created' THEN
          v_due_date := (v_event.created_at::DATE + v_step.date_offset_days);
        ELSE
          v_due_date := (COALESCE(v_event.main_shoot_date, v_event.event_date)::DATE + v_step.date_offset_days);
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
      NULL,
      v_step.label,
      v_count + 1,
      v_step.completion_type,
      v_step.auto_trigger_event,
      v_due_date,
      false,
      v_step.help_text
    );

    v_count := v_count + 1;
  END LOOP;

  RETURN jsonb_build_object(
    'success', true,
    'steps_created', v_count,
    'used_event_type_defaults', v_has_defaults
  );
END;
$function$;
