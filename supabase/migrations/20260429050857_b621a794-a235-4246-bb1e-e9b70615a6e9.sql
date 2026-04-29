REVOKE ALL ON FUNCTION public.can_view_profile_for_shared_event(uuid, uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.can_view_staff_for_shared_event(uuid, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.can_view_profile_for_shared_event(uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.can_view_staff_for_shared_event(uuid, uuid) TO authenticated;