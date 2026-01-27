
-- Fix the auto_complete_workflow_step function SQL syntax error
-- The UPDATE FROM JOIN pattern in PostgreSQL can't reference the updated table alias in SET clause

CREATE OR REPLACE FUNCTION public.auto_complete_workflow_step(
  p_entity_type TEXT,
  p_entity_id UUID,
  p_trigger_event TEXT
)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_count INTEGER := 0;
BEGIN
  -- Find and complete all matching auto steps
  -- Using a subquery approach to avoid the FROM-clause alias issue
  UPDATE public.workflow_instance_steps
  SET 
    is_complete = true,
    completed_at = NOW(),
    notes = COALESCE(workflow_instance_steps.notes, '') || ' [Auto-completed: ' || p_trigger_event || ']'
  WHERE id IN (
    SELECT wis.id
    FROM public.workflow_instance_steps wis
    JOIN public.workflow_instances wi ON wi.id = wis.instance_id
    JOIN public.workflow_template_items wti ON wti.id = wis.step_id
    WHERE wi.entity_type = p_entity_type
      AND wi.entity_id = p_entity_id
      AND wti.step_type = 'auto'
      AND wti.trigger_event = p_trigger_event
      AND wis.is_complete = false
  );
  
  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN v_count;
END;
$$;
