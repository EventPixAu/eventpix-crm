DROP POLICY IF EXISTS "Authenticated can view contact notes" ON public.client_contact_notes;
DROP POLICY IF EXISTS "Staff roles can view contact notes" ON public.client_contact_notes;
CREATE POLICY "Staff roles can view contact notes"
ON public.client_contact_notes FOR SELECT TO authenticated
USING (is_admin() OR can_access_sales(auth.uid()) OR can_access_operations(auth.uid()) OR created_by = auth.uid());

DROP POLICY IF EXISTS "Authenticated can view venue notes" ON public.venue_notes;
DROP POLICY IF EXISTS "Staff roles can view venue notes" ON public.venue_notes;
CREATE POLICY "Staff roles can view venue notes"
ON public.venue_notes FOR SELECT TO authenticated
USING (is_admin() OR can_access_sales(auth.uid()) OR can_access_operations(auth.uid()) OR created_by = auth.uid());