GRANT SELECT, INSERT, UPDATE ON public.event_delivery_preferences TO authenticated;
CREATE POLICY "Ops and sales insert delivery preferences" ON public.event_delivery_preferences FOR INSERT TO authenticated
WITH CHECK (can_access_operations(auth.uid()) OR can_access_sales(auth.uid()));
CREATE POLICY "Ops and sales update delivery preferences" ON public.event_delivery_preferences FOR UPDATE TO authenticated
USING (can_access_operations(auth.uid()) OR can_access_sales(auth.uid()))
WITH CHECK (can_access_operations(auth.uid()) OR can_access_sales(auth.uid()));