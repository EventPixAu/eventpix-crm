CREATE OR REPLACE FUNCTION public.is_team_member(_user_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id)
$$;

DO $$
DECLARE
  t text; p record;
  tbls text[] := ARRAY['lead_sources','event_types','event_brief_templates','event_type_step_defaults','editor_event_type_step_defaults','contact_relationship_types','contact_roles','job_titles','equipment_categories','gallery_assets','series_default_assignments','event_type_workflow_defaults','delivery_methods_lookup','editor_workflow_master_steps','company_categories','workflow_master_steps','locations','coverage_packages','equipment_kit_items','editing_instruction_templates','crew_checklist_template_event_types','package_items','ops_statuses','client_brief_templates','contact_types_lookup','workflow_template_items','staff_roles','company_statuses','workflow_templates','skills','venue_types','company_subcategories','role_section_visibility','site_settings','dress_codes','series_workflow_steps','staff_skills','lead_statuses'];
BEGIN
  FOREACH t IN ARRAY tbls LOOP
    FOR p IN SELECT policyname FROM pg_policies
      WHERE schemaname='public' AND tablename=t AND cmd IN ('SELECT','ALL')
        AND (qual = 'true' OR qual = '(auth.uid() IS NOT NULL)' OR qual = '(auth.role() = ''authenticated''::text)')
    LOOP
      EXECUTE format('DROP POLICY %I ON public.%I', p.policyname, t);
    END LOOP;
    EXECUTE format('CREATE POLICY "Team members can read %s" ON public.%I FOR SELECT TO authenticated USING (public.is_team_member(auth.uid()))', t, t);
  END LOOP;
END $$;

DROP POLICY IF EXISTS "Anyone can insert contract views" ON public.contract_views;
DROP POLICY IF EXISTS "Anyone can log quote acceptance attempts" ON public.quote_acceptance_attempts;
DROP POLICY IF EXISTS "Anyone can log contract acceptance attempts" ON public.contract_acceptance_attempts;

DROP POLICY IF EXISTS "Authenticated users can view galleries" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can view gallery images" ON storage.objects;
CREATE POLICY "Team members can view galleries" ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'galleries' AND public.is_team_member(auth.uid()));
CREATE POLICY "Team members can view gallery images" ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'eventpix-galleries' AND public.is_team_member(auth.uid()));