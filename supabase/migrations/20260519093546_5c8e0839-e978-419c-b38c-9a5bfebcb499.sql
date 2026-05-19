CREATE OR REPLACE FUNCTION public.complete_assigned_workflow_step(
  p_step_id uuid,
  p_event_id uuid,
  p_notes text DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.event_workflow_steps
  SET
    is_completed = true,
    completed_at = now(),
    completed_by = auth.uid(),
    notes = NULLIF(p_notes, '')
  WHERE id = p_step_id
    AND event_id = p_event_id
    AND completion_type = 'manual'
    AND (
      assigned_to = auth.uid()
      OR public.has_role(auth.uid(), 'admin')
      OR public.has_role(auth.uid(), 'operations')
      OR public.has_role(auth.uid(), 'sales')
    );

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Workflow step not found or not permitted';
  END IF;
END;
$$;

CREATE OR REPLACE FUNCTION public.uncomplete_assigned_workflow_step(
  p_step_id uuid,
  p_event_id uuid
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.event_workflow_steps
  SET
    is_completed = false,
    completed_at = null,
    completed_by = null
  WHERE id = p_step_id
    AND event_id = p_event_id
    AND completion_type = 'manual'
    AND (
      assigned_to = auth.uid()
      OR public.has_role(auth.uid(), 'admin')
      OR public.has_role(auth.uid(), 'operations')
      OR public.has_role(auth.uid(), 'sales')
    );

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Workflow step not found or not permitted';
  END IF;
END;
$$;

GRANT EXECUTE ON FUNCTION public.complete_assigned_workflow_step(uuid, uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.uncomplete_assigned_workflow_step(uuid, uuid) TO authenticated;