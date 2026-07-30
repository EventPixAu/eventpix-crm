-- 1. Remove token-bypass public read on quote_items
DROP POLICY IF EXISTS "Public can view quote items by valid quote" ON public.quote_items;

-- 2. Restrict quote_files to sales/admin
DROP POLICY IF EXISTS "Authenticated users can view quote files" ON public.quote_files;
DROP POLICY IF EXISTS "Authenticated users can insert quote files" ON public.quote_files;
DROP POLICY IF EXISTS "Authenticated users can delete quote files" ON public.quote_files;

CREATE POLICY "Sales and admins can view quote files"
ON public.quote_files FOR SELECT TO authenticated
USING (public.is_admin() OR public.can_access_sales(auth.uid()));

CREATE POLICY "Sales and admins can insert quote files"
ON public.quote_files FOR INSERT TO authenticated
WITH CHECK (public.is_admin() OR public.can_access_sales(auth.uid()));

CREATE POLICY "Sales and admins can update quote files"
ON public.quote_files FOR UPDATE TO authenticated
USING (public.is_admin() OR public.can_access_sales(auth.uid()))
WITH CHECK (public.is_admin() OR public.can_access_sales(auth.uid()));

CREATE POLICY "Sales and admins can delete quote files"
ON public.quote_files FOR DELETE TO authenticated
USING (public.is_admin() OR public.can_access_sales(auth.uid()));

-- 3. Restrict quote-files storage bucket
DROP POLICY IF EXISTS "Authenticated users can read quote files" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can upload quote files" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can delete quote files" ON storage.objects;

CREATE POLICY "Sales and admins can read quote file objects"
ON storage.objects FOR SELECT TO authenticated
USING (bucket_id = 'quote-files' AND (public.is_admin() OR public.can_access_sales(auth.uid())));

CREATE POLICY "Sales and admins can upload quote file objects"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'quote-files' AND (public.is_admin() OR public.can_access_sales(auth.uid())));

CREATE POLICY "Sales and admins can update quote file objects"
ON storage.objects FOR UPDATE TO authenticated
USING (bucket_id = 'quote-files' AND (public.is_admin() OR public.can_access_sales(auth.uid())))
WITH CHECK (bucket_id = 'quote-files' AND (public.is_admin() OR public.can_access_sales(auth.uid())));

CREATE POLICY "Sales and admins can delete quote file objects"
ON storage.objects FOR DELETE TO authenticated
USING (bucket_id = 'quote-files' AND (public.is_admin() OR public.can_access_sales(auth.uid())));