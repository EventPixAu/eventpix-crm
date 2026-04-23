
CREATE OR REPLACE FUNCTION public.sync_event_type_workflow_to_upcoming(p_event_type_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  v_event RECORD;
  v_step RECORD;
  v_due_date DATE;
  v_job_accepted_date DATE;
  v_has_defaults boolean := false;
  v_events_updated int := 0;
  v_steps_added int := 0;
  v_steps_removed int := 0;
  v_order int;
BEGIN
  IF p_event_type_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'event_type_id required');
  END IF;

  -- Determine if defaults exist for this event type
  SELECT EXISTS (
    SELECT 1 FROM event_type_step_defaults d
    JOIN workflow_master_steps s ON s.id = d.master_step_id
    WHERE d.event_type_id = p_event_type_id AND s.is_active = true
  ) INTO v_has_defaults;

  -- Iterate upcoming events of this event type
  FOR v_event IN
    SELECT * FROM events
    WHERE event_type_id = p_event_type_id
      AND COALESCE(main_shoot_date, event_date)::date >= CURRENT_DATE
  LOOP
    -- Compute job_accepted date for this event
    v_job_accepted_date := NULL;
    IF v_event.lead_id IS NOT NULL THEN
      SELECT (updated_at)::date INTO v_job_accepted_date
      FROM leads WHERE id = v_event.lead_id AND status = 'won';
    END IF;
    v_job_accepted_date := COALESCE(v_job_accepted_date, v_event.booking_date::date, v_event.created_at::date, CURRENT_DATE);

    -- Remove non-completed steps that are NOT in the new defaults set (by label match)
    WITH target_labels AS (
      SELECT s.label FROM workflow_master_steps s
      WHERE s.is_active = true
        AND (
          NOT v_has_defaults
          OR EXISTS (
            SELECT 1 FROM event_type_step_defaults d
            WHERE d.master_step_id = s.id AND d.event_type_id = p_event_type_id
          )
        )
    ),
    deleted AS (
      DELETE FROM event_workflow_steps
      WHERE event_id = v_event.id
        AND COALESCE(is_completed, false) = false
        AND step_label NOT IN (SELECT label FROM target_labels)
      RETURNING 1
    )
    SELECT count(*) INTO v_step FROM deleted;
    v_steps_removed := v_steps_removed + COALESCE((SELECT count(*) FROM (SELECT 1) x), 0);

    -- Insert any missing steps from the target set
    v_order := COALESCE((SELECT max(step_order) FROM event_workflow_steps WHERE event_id = v_event.id), 0);

    FOR v_step IN
      SELECT s.*
      FROM workflow_master_steps s
      WHERE s.is_active = true
        AND (
          NOT v_has_defaults
          OR EXISTS (
            SELECT 1 FROM event_type_step_defaults d
            WHERE d.master_step_id = s.id AND d.event_type_id = p_event_type_id
          )
        )
        AND NOT EXISTS (
          SELECT 1 FROM event_workflow_steps ews
          WHERE ews.event_id = v_event.id AND ews.step_label = s.label
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

      v_order := v_order + 1;
      INSERT INTO event_workflow_steps (
        event_id, template_item_id, step_label, step_order,
        completion_type, auto_trigger_event, due_date, is_completed, notes
      ) VALUES (
        v_event.id, NULL, v_step.label, v_order,
        v_step.completion_type, v_step.auto_trigger_event, v_due_date, false, v_step.help_text
      );
      v_steps_added := v_steps_added + 1;
    END LOOP;

    v_events_updated := v_events_updated + 1;
  END LOOP;

  RETURN jsonb_build_object(
    'success', true,
    'events_updated', v_events_updated,
    'steps_added', v_steps_added,
    'used_event_type_defaults', v_has_defaults
  );
END;
$function$;

GRANT EXECUTE ON FUNCTION public.sync_event_type_workflow_to_upcoming(uuid) TO authenticated;
