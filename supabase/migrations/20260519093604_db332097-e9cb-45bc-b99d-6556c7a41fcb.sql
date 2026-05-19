REVOKE EXECUTE ON FUNCTION public.complete_assigned_workflow_step(uuid, uuid, text) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.complete_assigned_workflow_step(uuid, uuid, text) FROM anon;
REVOKE EXECUTE ON FUNCTION public.uncomplete_assigned_workflow_step(uuid, uuid) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.uncomplete_assigned_workflow_step(uuid, uuid) FROM anon;

GRANT EXECUTE ON FUNCTION public.complete_assigned_workflow_step(uuid, uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.uncomplete_assigned_workflow_step(uuid, uuid) TO authenticated;