-- Restrict company_statuses reads to authenticated users
DROP POLICY IF EXISTS "Anyone can read company_statuses" ON public.company_statuses;
CREATE POLICY "Authenticated can read company_statuses"
ON public.company_statuses
FOR SELECT
TO authenticated
USING (true);

-- Restrict the broad "Staff can manage event tasks" policy to SELECT only.
-- Admin/Operations/Sales policies already cover write access for the appropriate roles.
DROP POLICY IF EXISTS "Staff can manage event tasks" ON public.tasks;
CREATE POLICY "Staff can view event tasks"
ON public.tasks
FOR SELECT
TO authenticated
USING (
  related_type = 'event'
  AND EXISTS (
    SELECT 1 FROM public.event_assignments ea
    WHERE ea.event_id = tasks.related_id
      AND ea.user_id = auth.uid()
  )
);