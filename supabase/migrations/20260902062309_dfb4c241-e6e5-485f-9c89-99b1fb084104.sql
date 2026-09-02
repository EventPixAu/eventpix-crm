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
      p_series_id, v_step.id, v_step.label, v_step.phase::workflow_phase, v_order,
      v_step.completion_type, v_step.auto_trigger_event, v_step.help_text
    );
    v_added := v_added + 1;
  END LOOP;

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