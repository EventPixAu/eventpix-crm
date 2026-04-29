CREATE OR REPLACE FUNCTION public.can_view_profile_for_shared_event(_viewer_id uuid, _profile_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    _viewer_id = _profile_id
    OR public.can_access_sales(_viewer_id)
    OR public.can_access_operations(_viewer_id)
    OR EXISTS (
      SELECT 1
      FROM public.event_assignments viewer_assignment
      JOIN public.event_assignments target_assignment
        ON target_assignment.event_id = viewer_assignment.event_id
      LEFT JOIN public.staff target_staff
        ON target_staff.id = target_assignment.staff_id
      WHERE (
        viewer_assignment.user_id = _viewer_id
        OR EXISTS (
          SELECT 1
          FROM public.staff viewer_staff
          WHERE viewer_staff.id = viewer_assignment.staff_id
            AND viewer_staff.user_id = _viewer_id
        )
      )
      AND (
        target_assignment.user_id = _profile_id
        OR target_staff.user_id = _profile_id
      )
    )
$$;

CREATE OR REPLACE FUNCTION public.can_view_staff_for_shared_event(_viewer_id uuid, _staff_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    public.can_access_sales(_viewer_id)
    OR public.can_access_operations(_viewer_id)
    OR EXISTS (
      SELECT 1
      FROM public.staff own_staff
      WHERE own_staff.id = _staff_id
        AND own_staff.user_id = _viewer_id
    )
    OR EXISTS (
      SELECT 1
      FROM public.event_assignments viewer_assignment
      JOIN public.event_assignments target_assignment
        ON target_assignment.event_id = viewer_assignment.event_id
      WHERE target_assignment.staff_id = _staff_id
        AND (
          viewer_assignment.user_id = _viewer_id
          OR EXISTS (
            SELECT 1
            FROM public.staff viewer_staff
            WHERE viewer_staff.id = viewer_assignment.staff_id
              AND viewer_staff.user_id = _viewer_id
          )
        )
    )
$$;

DROP POLICY IF EXISTS "Sales can view event assignments" ON public.event_assignments;
CREATE POLICY "Sales can view event assignments"
ON public.event_assignments
FOR SELECT
TO authenticated
USING (public.can_access_sales(auth.uid()));

DROP POLICY IF EXISTS "Crew can view shared assignment profiles" ON public.profiles;
CREATE POLICY "Crew can view shared assignment profiles"
ON public.profiles
FOR SELECT
TO authenticated
USING (public.can_view_profile_for_shared_event(auth.uid(), id));

DROP POLICY IF EXISTS "Sales can read staff" ON public.staff;
CREATE POLICY "Sales can read staff"
ON public.staff
FOR SELECT
TO authenticated
USING (public.can_access_sales(auth.uid()));

DROP POLICY IF EXISTS "Crew can view shared assignment staff" ON public.staff;
CREATE POLICY "Crew can view shared assignment staff"
ON public.staff
FOR SELECT
TO authenticated
USING (public.can_view_staff_for_shared_event(auth.uid(), id));