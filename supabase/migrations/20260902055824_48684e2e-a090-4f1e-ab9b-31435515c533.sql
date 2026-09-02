ALTER TABLE public.workflow_master_steps
  ADD COLUMN IF NOT EXISTS is_series_level boolean NOT NULL DEFAULT false;

CREATE TABLE IF NOT EXISTS public.series_workflow_steps (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  series_id uuid NOT NULL REFERENCES public.event_series(id) ON DELETE CASCADE,
  master_step_id uuid REFERENCES public.workflow_master_steps(id) ON DELETE SET NULL,
  step_label text NOT NULL,
  phase public.workflow_phase NOT NULL DEFAULT 'pre_event',
  step_order integer NOT NULL DEFAULT 0,
  completion_type text,
  auto_trigger_event text,
  due_date date,
  is_completed boolean NOT NULL DEFAULT false,
  completed_at timestamptz,
  completed_by uuid,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (series_id, step_label)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.series_workflow_steps TO authenticated;
GRANT ALL ON public.series_workflow_steps TO service_role;

ALTER TABLE public.series_workflow_steps ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated can view series workflow steps"
  ON public.series_workflow_steps FOR SELECT TO authenticated USING (true);

CREATE POLICY "Admins and ops manage series workflow steps"
  ON public.series_workflow_steps FOR ALL TO authenticated
  USING (public.is_admin() OR public.is_executive(auth.uid()) OR public.is_operations())
  WITH CHECK (public.is_admin() OR public.is_executive(auth.uid()) OR public.is_operations());

CREATE TRIGGER trg_series_workflow_steps_updated_at
  BEFORE UPDATE ON public.series_workflow_steps
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE OR REPLACE FUNCTION public.sync_series_workflow_steps(p_series_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  v_added int := 0;
  v_removed int := 0;
  v_order int;
  v_step RECORD;
BEGIN
  IF p_series_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'series_id required');
  END IF;

  WITH target AS (
    SELECT DISTINCT s.label
    FROM public.workflow_master_steps s
    WHERE s.is_active = true
      AND s.is_series_level = true
      AND (
        EXISTS (
          SELECT 1
          FROM public.event_type_step_defaults d
          JOIN public.events e ON e.event_type_id = d.event_type_id
          WHERE d.master_step_id = s.id
            AND e.event_series_id = p_series_id
        )
        OR EXISTS (
          SELECT 1 FROM public.event_series es
          WHERE es.id = p_series_id
            AND es.default_workflow_step_ids IS NOT NULL
            AND s.id = ANY (es.default_workflow_step_ids)
        )
      )
  ),
  deleted AS (
    DELETE FROM public.series_workflow_steps sw
    WHERE sw.series_id = p_series_id
      AND COALESCE(sw.is_completed, false) = false
      AND sw.step_label NOT IN (SELECT label FROM target)
    RETURNING 1
  )
  SELECT count(*) INTO v_removed FROM deleted;

  v_order := COALESCE((SELECT max(step_order) FROM public.series_workflow_steps WHERE series_id = p_series_id), 0);

  FOR v_step IN
    SELECT DISTINCT ON (s.label) s.*
    FROM public.workflow_master_steps s
    WHERE s.is_active = true
      AND s.is_series_level = true
      AND (
        EXISTS (
          SELECT 1
          FROM public.event_type_step_defaults d
          JOIN public.events e ON e.event_type_id = d.event_type_id
          WHERE d.master_step_id = s.id
            AND e.event_series_id = p_series_id
        )
        OR EXISTS (
          SELECT 1 FROM public.event_series es
          WHERE es.id = p_series_id
            AND es.default_workflow_step_ids IS NOT NULL
            AND s.id = ANY (es.default_workflow_step_ids)
        )
      )
      AND NOT EXISTS (
        SELECT 1 FROM public.series_workflow_steps sw
        WHERE sw.series_id = p_series_id AND sw.step_label = s.label
      )
    ORDER BY s.label, s.sort_order
  LOOP
    v_order := v_order + 1;
    INSERT INTO public.series_workflow_steps (
      series_id, master_step_id, step_label, phase, step_order,
      completion_type, auto_trigger_event, notes
    ) VALUES (
      p_series_id, v_step.id, v_step.label, v_step.phase, v_order,
      v_step.completion_type, v_step.auto_trigger_event, v_step.help_text
    );
    v_added := v_added + 1;
  END LOOP;

  -- Remove series-level steps duplicated on individual events in this series
  DELETE FROM public.event_workflow_steps ews
  USING public.events e
  WHERE ews.event_id = e.id
    AND e.event_series_id = p_series_id
    AND COALESCE(ews.is_completed, false) = false
    AND ews.step_label IN (
      SELECT label FROM public.workflow_master_steps
      WHERE is_series_level = true AND is_active = true
    );

  RETURN jsonb_build_object('success', true, 'steps_added', v_added, 'steps_removed', v_removed);
END;
$function$;

-- Skip series-level steps for events that belong to a series
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
  SELECT * INTO v_event FROM events WHERE id = p_event_id;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Event not found');
  END IF;

  IF v_event.lead_id IS NOT NULL THEN
    SELECT (updated_at)::date INTO v_job_accepted_date
    FROM leads
    WHERE id = v_event.lead_id AND status = 'won';
  END IF;
  v_job_accepted_date := COALESCE(v_job_accepted_date, v_event.booking_date::date, v_event.created_at::date, CURRENT_DATE);

  DELETE FROM event_workflow_steps WHERE event_id = p_event_id;

  IF v_event.event_type_id IS NOT NULL THEN
    SELECT EXISTS (
      SELECT 1 FROM event_type_step_defaults d
      JOIN workflow_master_steps s ON s.id = d.master_step_id
      WHERE d.event_type_id = v_event.event_type_id
        AND s.is_active = true
    ) INTO v_has_defaults;
  END IF;

  FOR v_step IN
    SELECT s.*
    FROM workflow_master_steps s
    WHERE s.is_active = true
      AND NOT (s.is_series_level = true AND v_event.event_series_id IS NOT NULL)
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
      event_id, template_item_id, step_label, step_order,
      completion_type, auto_trigger_event, due_date, is_completed, notes
    ) VALUES (
      p_event_id, NULL, v_step.label, v_count + 1,
      v_step.completion_type, v_step.auto_trigger_event, v_due_date, false, v_step.help_text
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
  v_removed_count int := 0;
  v_order int;
BEGIN
  IF p_event_type_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'event_type_id required');
  END IF;

  SELECT EXISTS (
    SELECT 1
    FROM public.event_type_step_defaults d
    JOIN public.workflow_master_steps s ON s.id = d.master_step_id
    WHERE d.event_type_id = p_event_type_id
      AND s.is_active = true
  ) INTO v_has_defaults;

  FOR v_event IN
    SELECT *
    FROM public.events
    WHERE event_type_id = p_event_type_id
      AND COALESCE(main_shoot_date, event_date)::date >= CURRENT_DATE
  LOOP
    v_job_accepted_date := NULL;
    IF v_event.lead_id IS NOT NULL THEN
      SELECT (updated_at)::date INTO v_job_accepted_date
      FROM public.leads
      WHERE id = v_event.lead_id
        AND status = 'won';
    END IF;
    v_job_accepted_date := COALESCE(v_job_accepted_date, v_event.booking_date::date, v_event.created_at::date, CURRENT_DATE);

    WITH target_labels AS (
      SELECT s.label
      FROM public.workflow_master_steps s
      WHERE s.is_active = true
        AND NOT (s.is_series_level = true AND v_event.event_series_id IS NOT NULL)
        AND EXISTS (
          SELECT 1
          FROM public.event_type_step_defaults d
          WHERE d.master_step_id = s.id
            AND d.event_type_id = p_event_type_id
        )
    ),
    deleted AS (
      DELETE FROM public.event_workflow_steps
      WHERE event_id = v_event.id
        AND COALESCE(is_completed, false) = false
        AND step_label NOT IN (SELECT label FROM target_labels)
      RETURNING 1
    )
    SELECT count(*) INTO v_removed_count FROM deleted;

    v_steps_removed := v_steps_removed + COALESCE(v_removed_count, 0);
    v_order := COALESCE((SELECT max(step_order) FROM public.event_workflow_steps WHERE event_id = v_event.id), 0);

    FOR v_step IN
      SELECT
        s.label,
        s.phase,
        s.sort_order,
        CASE
          WHEN lower(COALESCE(r.name, '')) LIKE '%editor%'
            AND lower(COALESCE(r.name, '')) NOT LIKE '%admin%'
            AND lower(COALESCE(r.name, '')) NOT LIKE '%video%'
          THEN 1
          ELSE 0
        END AS scope_order,
        s.completion_type,
        s.auto_trigger_event,
        s.date_offset_days,
        s.date_offset_reference,
        s.help_text
      FROM public.workflow_master_steps s
      LEFT JOIN public.staff_roles r ON r.id = s.default_staff_role_id
      WHERE s.is_active = true
        AND NOT (s.is_series_level = true AND v_event.event_series_id IS NOT NULL)
        AND EXISTS (
          SELECT 1
          FROM public.event_type_step_defaults d
          WHERE d.master_step_id = s.id
            AND d.event_type_id = p_event_type_id
        )
        AND NOT EXISTS (
          SELECT 1
          FROM public.event_workflow_steps ews
          WHERE ews.event_id = v_event.id
            AND ews.step_label = s.label
        )
      ORDER BY
        CASE s.phase
          WHEN 'pre_event' THEN 1
          WHEN 'day_of' THEN 2
          WHEN 'post_event' THEN 3
          ELSE 4
        END,
        scope_order,
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
      INSERT INTO public.event_workflow_steps (
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
    'steps_removed', v_steps_removed,
    'used_event_type_defaults', v_has_defaults
  );
END;
$function$;