CREATE OR REPLACE FUNCTION public.sync_my_crew_checklist_from_template(_event_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _checklist_id uuid;
  _template_id uuid;
BEGIN
  SELECT id, template_id INTO _checklist_id, _template_id
  FROM public.crew_checklists
  WHERE event_id = _event_id
    AND user_id = auth.uid()
  LIMIT 1;

  IF _checklist_id IS NULL OR _template_id IS NULL THEN
    RETURN;
  END IF;

  PERFORM public.sync_crew_checklists_from_template(_template_id);
END;
$$;

REVOKE ALL ON FUNCTION public.sync_my_crew_checklist_from_template(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.sync_my_crew_checklist_from_template(uuid) TO authenticated;

REVOKE ALL ON FUNCTION public.sync_crew_checklists_from_template(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.sync_crew_checklists_from_template(uuid) TO authenticated, service_role;

REVOKE ALL ON FUNCTION public.trg_sync_crew_checklists_from_template() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.trg_sync_crew_checklists_from_template() TO service_role;