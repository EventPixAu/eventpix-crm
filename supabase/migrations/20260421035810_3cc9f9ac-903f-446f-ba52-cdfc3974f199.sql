-- 1. Fix contract_views: restrict IP/user-agent visibility to admin & sales
DROP POLICY IF EXISTS "Authenticated users can view contract views" ON public.contract_views;

CREATE POLICY "Admins and sales can view contract views"
ON public.contract_views
FOR SELECT
TO authenticated
USING (public.has_role(auth.uid(), 'admin'::app_role) OR public.has_role(auth.uid(), 'sales'::app_role));

-- 2. Fix editing_instruction_templates: split read vs write
DROP POLICY IF EXISTS "Authenticated users can manage editing instruction templates" ON public.editing_instruction_templates;

CREATE POLICY "Authenticated users can view editing instruction templates"
ON public.editing_instruction_templates
FOR SELECT
TO authenticated
USING (true);

CREATE POLICY "Admins can manage editing instruction templates"
ON public.editing_instruction_templates
FOR ALL
TO authenticated
USING (public.has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));

-- 3. Fix public bucket listing: restrict galleries SELECT to authenticated
-- (Public access to individual files via signed/direct URLs still works through CDN)
DROP POLICY IF EXISTS "Public can view galleries" ON storage.objects;
DROP POLICY IF EXISTS "Anyone can view galleries" ON storage.objects;
DROP POLICY IF EXISTS "Public read access for galleries" ON storage.objects;
DROP POLICY IF EXISTS "Galleries are publicly accessible" ON storage.objects;

CREATE POLICY "Authenticated users can view galleries"
ON storage.objects
FOR SELECT
TO authenticated
USING (bucket_id = 'galleries');