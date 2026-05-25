-- 1. Add default assignee column to workflow master steps
ALTER TABLE public.workflow_master_steps
  ADD COLUMN IF NOT EXISTS default_assignee_user_id uuid
    REFERENCES auth.users(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_workflow_master_steps_default_assignee
  ON public.workflow_master_steps(default_assignee_user_id)
  WHERE default_assignee_user_id IS NOT NULL;

-- 2. Update initialize_event_workflow_steps to copy the default assignee
--    when a master step with the same label exists.
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
  v_default_assignee uuid;
BEGIN
  SELECT * INTO v_event FROM events WHERE id = p_event_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Event not found';
  END IF;

  IF v_event.lead_id IS NOT NULL THEN
    SELECT (updated_at)::date INTO v_job_accepted_date
    FROM leads
    WHERE id = v_event.lead_id AND status = 'won';
  END IF;

  v_job_accepted_date := COALESCE(v_job_accepted_date, v_event.booking_date::date, v_event.created_at::date, CURRENT_DATE);

  DELETE FROM event_workflow_steps WHERE event_id = p_event_id;

  FOR v_item IN
    SELECT * FROM workflow_template_items
    WHERE template_id = p_template_id
      AND is_active = true
    ORDER BY sort_order
  LOOP
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

    -- Resolve default assignee from matching master step by label
    SELECT default_assignee_user_id INTO v_default_assignee
    FROM workflow_master_steps
    WHERE label = v_item.label
      AND is_active = true
      AND default_assignee_user_id IS NOT NULL
    LIMIT 1;

    INSERT INTO event_workflow_steps (
      event_id, template_item_id, step_label, step_order,
      completion_type, auto_trigger_event, due_date, is_completed, notes,
      assigned_to
    ) VALUES (
      p_event_id, v_item.id, v_item.label, v_item.sort_order,
      v_item.completion_type, v_item.auto_trigger_event, v_due_date, false, NULL,
      v_default_assignee
    );

    v_count := v_count + 1;
    v_default_assignee := NULL;
  END LOOP;

  RETURN v_count;
END;
$function$;

-- 3. Bulk-apply RPC: assign a user to all open, unassigned event_workflow_steps
--    that match (by label) a master step where they are the default assignee.
CREATE OR REPLACE FUNCTION public.apply_default_step_assignees(p_user_id uuid)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_count integer;
BEGIN
  IF NOT (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'operations'::app_role)) THEN
    RAISE EXCEPTION 'Not authorised';
  END IF;

  WITH updated AS (
    UPDATE event_workflow_steps ews
    SET assigned_to = p_user_id,
        updated_at = now()
    FROM workflow_master_steps wms
    JOIN events e ON true
    WHERE ews.step_label = wms.label
      AND wms.default_assignee_user_id = p_user_id
      AND wms.is_active = true
      AND ews.assigned_to IS NULL
      AND ews.is_completed = false
      AND ews.event_id = e.id
      AND COALESCE(e.ops_status, '') NOT IN ('cancelled','closed')
    RETURNING ews.id
  )
  SELECT count(*) INTO v_count FROM updated;

  RETURN v_count;
END;
$function$;

GRANT EXECUTE ON FUNCTION public.apply_default_step_assignees(uuid) TO authenticated;