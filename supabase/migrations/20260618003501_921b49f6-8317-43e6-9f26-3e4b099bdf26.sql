REVOKE ALL ON FUNCTION public.sync_my_crew_checklist_from_template(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.sync_my_crew_checklist_from_template(uuid) TO authenticated, service_role;

REVOKE ALL ON FUNCTION public.sync_crew_checklists_from_template(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.sync_crew_checklists_from_template(uuid) TO authenticated, service_role;

REVOKE ALL ON FUNCTION public.trg_sync_crew_checklists_from_template() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.trg_sync_crew_checklists_from_template() TO service_role;