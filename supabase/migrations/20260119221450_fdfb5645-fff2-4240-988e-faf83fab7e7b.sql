-- Part 1: Create complete_workflow_step RPC
CREATE OR REPLACE FUNCTION public.complete_workflow_step(
  p_step_id uuid,
  p_is_complete boolean
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_user_id uuid := auth.uid();
  v_row record;
BEGIN
  IF v_user_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Not authenticated');
  END IF;

  -- Fetch the step row + related metadata
  SELECT
    wis.id AS workflow_instance_step_id,
    wis.is_locked,
    wis.instance_id AS workflow_instance_id,
    wi.entity_type,
    wi.entity_id,
    wti.label AS step_label
  INTO v_row
  FROM workflow_instance_steps wis
  JOIN workflow_instances wi ON wi.id = wis.instance_id
  JOIN workflow_template_items wti ON wti.id = wis.step_id
  WHERE wis.id = p_step_id;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Step not found');
  END IF;

  IF v_row.is_locked THEN
    RETURN jsonb_build_object('success', false, 'error', 'Step is locked');
  END IF;

  -- Authorization: Admin or Operations only
  IF NOT EXISTS (
    SELECT 1 FROM user_roles ur
    WHERE ur.user_id = v_user_id
      AND ur.role IN ('admin', 'operations')
  ) THEN
    RETURN jsonb_build_object('success', false, 'error', 'Not permitted');
  END IF;

  UPDATE workflow_instance_steps
  SET
    is_complete  = p_is_complete,
    completed_at = CASE WHEN p_is_complete THEN now() ELSE NULL END,
    completed_by = CASE WHEN p_is_complete THEN v_user_id ELSE NULL END
  WHERE id = p_step_id
    AND is_locked = false;

  RETURN jsonb_build_object(
    'success', true,
    'workflow_instance_id', v_row.workflow_instance_id,
    'entity_type', v_row.entity_type,
    'entity_id', v_row.entity_id,
    'step_label', v_row.step_label,
    'is_complete', p_is_complete
  );
END;
$$;

REVOKE ALL ON FUNCTION public.complete_workflow_step(uuid, boolean) FROM public;
GRANT EXECUTE ON FUNCTION public.complete_workflow_step(uuid, boolean) TO authenticated;

-- Part 2: Create tg_convert_lead_on_job_accepted trigger
CREATE OR REPLACE FUNCTION public.tg_convert_lead_on_job_accepted()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_step_label text;
  v_entity_type text;
  v_entity_id uuid;
  v_already_converted uuid;
  v_result jsonb;
BEGIN
  -- Only when transitioning to complete
  IF (COALESCE(OLD.is_complete, false) = false) AND (NEW.is_complete = true) THEN

    SELECT wti.label, wi.entity_type, wi.entity_id
    INTO v_step_label, v_entity_type, v_entity_id
    FROM workflow_instance_steps wis
    JOIN workflow_instances wi ON wi.id = wis.instance_id
    JOIN workflow_template_items wti ON wti.id = wis.step_id
    WHERE wis.id = NEW.id;

    IF v_entity_type = 'lead' AND v_step_label ILIKE 'Job accepted' THEN

      -- Check if already converted (idempotent)
      SELECT l.converted_job_id
      INTO v_already_converted
      FROM leads l
      WHERE l.id = v_entity_id;

      IF v_already_converted IS NULL THEN
        -- Call convert function (uses the uuid version)
        v_result := public.convert_enquiry_to_event(v_entity_id);

        -- Store the event_id back on the lead if successful
        IF COALESCE((v_result->>'success')::boolean, false) = true THEN
          UPDATE leads
          SET converted_job_id = (v_result->>'event_id')::uuid
          WHERE id = v_entity_id;
        END IF;
      END IF;

    END IF;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_convert_lead_on_job_accepted ON public.workflow_instance_steps;

CREATE TRIGGER trg_convert_lead_on_job_accepted
AFTER UPDATE OF is_complete ON public.workflow_instance_steps
FOR EACH ROW
EXECUTE FUNCTION public.tg_convert_lead_on_job_accepted();

-- Part 3: Enable realtime on leads table for conversion redirect
ALTER PUBLICATION supabase_realtime ADD TABLE public.leads;