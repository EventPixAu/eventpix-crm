
DROP POLICY IF EXISTS "Anyone can view dress codes" ON public.dress_codes;
CREATE POLICY "Authenticated can view dress codes" ON public.dress_codes FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "Anyone can read active onboarding sections" ON public.onboarding_guide_sections;
CREATE POLICY "Authenticated can read onboarding sections" ON public.onboarding_guide_sections FOR SELECT TO authenticated USING ((is_active = true) OR has_role(auth.uid(), 'admin'::app_role));

DROP POLICY IF EXISTS "Authenticated can read compliance_document_types" ON public.compliance_document_types;
CREATE POLICY "Authenticated can read compliance_document_types" ON public.compliance_document_types FOR SELECT TO authenticated USING (is_active = true);
