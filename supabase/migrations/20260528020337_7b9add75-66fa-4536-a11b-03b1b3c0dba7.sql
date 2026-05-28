
-- 1. company_insurance_policies: restrict SELECT to admins only
DROP POLICY IF EXISTS "Authenticated users can view insurance policies" ON public.company_insurance_policies;
CREATE POLICY "Admins can view insurance policies"
  ON public.company_insurance_policies
  FOR SELECT
  TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role));

-- 2. automations: restrict SELECT to admin/operations
DROP POLICY IF EXISTS "Authenticated can view active automations" ON public.automations;
CREATE POLICY "Admin and ops can view automations"
  ON public.automations
  FOR SELECT
  TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role) OR can_access_operations(auth.uid()));

-- 3. event_type_workflow_defaults: require authentication
DROP POLICY IF EXISTS "Authenticated can read event_type_workflow_defaults" ON public.event_type_workflow_defaults;
CREATE POLICY "Authenticated can read event_type_workflow_defaults"
  ON public.event_type_workflow_defaults
  FOR SELECT
  TO authenticated
  USING (auth.uid() IS NOT NULL);

-- 4. quote_items: restrict public token access to sent/accepted only
DROP POLICY IF EXISTS "Public can view quote items by valid quote" ON public.quote_items;
CREATE POLICY "Public can view quote items by valid quote"
  ON public.quote_items
  FOR SELECT
  TO anon, authenticated
  USING (EXISTS (
    SELECT 1 FROM public.quotes q
    WHERE q.id = quote_items.quote_id
      AND q.public_token IS NOT NULL
      AND q.status IN ('sent'::quote_status, 'accepted'::quote_status)
  ));

-- 5. Storage: restrict brief template buckets to admin/operations
DROP POLICY IF EXISTS "Authenticated users can read brief template files" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can upload brief template files" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can delete brief template files" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated can read client brief template files" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated can upload client brief template files" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated can update client brief template files" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated can delete client brief template files" ON storage.objects;

CREATE POLICY "Admin/ops can read brief template files"
  ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id IN ('brief-template-files','client-brief-template-files')
         AND (has_role(auth.uid(),'admin'::app_role) OR can_access_operations(auth.uid())));

CREATE POLICY "Admin/ops can upload brief template files"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id IN ('brief-template-files','client-brief-template-files')
              AND (has_role(auth.uid(),'admin'::app_role) OR can_access_operations(auth.uid())));

CREATE POLICY "Admin/ops can update brief template files"
  ON storage.objects FOR UPDATE TO authenticated
  USING (bucket_id IN ('brief-template-files','client-brief-template-files')
         AND (has_role(auth.uid(),'admin'::app_role) OR can_access_operations(auth.uid())))
  WITH CHECK (bucket_id IN ('brief-template-files','client-brief-template-files')
              AND (has_role(auth.uid(),'admin'::app_role) OR can_access_operations(auth.uid())));

CREATE POLICY "Admin/ops can delete brief template files"
  ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id IN ('brief-template-files','client-brief-template-files')
         AND (has_role(auth.uid(),'admin'::app_role) OR can_access_operations(auth.uid())));
