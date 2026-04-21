
-- 1. Xero tokens: explicit admin-only SELECT, drop ALL policy ambiguity
DROP POLICY IF EXISTS "Admins can manage xero tokens" ON public.xero_tokens;

CREATE POLICY "Admins can select xero tokens"
ON public.xero_tokens FOR SELECT TO authenticated
USING (public.has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can insert xero tokens"
ON public.xero_tokens FOR INSERT TO authenticated
WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can update xero tokens"
ON public.xero_tokens FOR UPDATE TO authenticated
USING (public.has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can delete xero tokens"
ON public.xero_tokens FOR DELETE TO authenticated
USING (public.has_role(auth.uid(), 'admin'::app_role));

-- 2. Skills: restrict read to authenticated only
DROP POLICY IF EXISTS "Authenticated can read skills" ON public.skills;

CREATE POLICY "Authenticated users can read skills"
ON public.skills FOR SELECT TO authenticated
USING (true);

-- 3. Storage: drop overly permissive public SELECT/listing policies on storage.objects
DO $$
DECLARE pol RECORD;
BEGIN
  FOR pol IN 
    SELECT policyname FROM pg_policies 
    WHERE schemaname = 'storage' AND tablename = 'objects' 
      AND cmd = 'SELECT'
      AND (qual = 'true' OR qual ILIKE '%true%' AND qual NOT ILIKE '%bucket_id%' AND qual NOT ILIKE '%auth.%')
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON storage.objects', pol.policyname);
  END LOOP;
END $$;
