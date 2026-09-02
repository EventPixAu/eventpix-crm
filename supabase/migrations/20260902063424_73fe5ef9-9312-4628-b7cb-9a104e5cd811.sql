DELETE FROM public.event_workflow_steps ws
USING public.events e
WHERE ws.event_id = e.id
  AND e.event_series_id IS NOT NULL
  AND ws.step_label IN (
    SELECT label FROM public.workflow_master_steps
    WHERE is_active = true AND is_series_level = true
  );