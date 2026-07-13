GRANT SELECT ON public.onboarding_guide_sections TO anon;
CREATE POLICY "Public can read active onboarding sections" ON public.onboarding_guide_sections FOR SELECT TO anon USING (is_active = true);