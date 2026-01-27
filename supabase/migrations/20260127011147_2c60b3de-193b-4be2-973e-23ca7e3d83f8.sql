-- Fix RLS policy on staff table to allow crew role to view staff
-- Current policy only allows 'photographer' but we use 'crew' role

DROP POLICY IF EXISTS "Photographers can view staff" ON public.staff;

CREATE POLICY "Crew can view staff directory"
ON public.staff
FOR SELECT
TO authenticated
USING (
  has_role(auth.uid(), 'crew'::app_role) OR
  has_role(auth.uid(), 'photographer'::app_role)
);