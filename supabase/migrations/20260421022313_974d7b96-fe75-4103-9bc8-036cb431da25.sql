
-- 1. audit_log: prevent spoofing actor_user_id
DROP POLICY IF EXISTS "Authenticated users can insert audit logs" ON public.audit_log;
CREATE POLICY "Users can insert their own audit logs"
ON public.audit_log FOR INSERT TO authenticated
WITH CHECK (actor_user_id = auth.uid() OR actor_user_id IS NULL AND auth.uid() IS NOT NULL);

-- 2. series_fixed_rates: restrict SELECT to admin/operations
DROP POLICY IF EXISTS "Authenticated read series_fixed_rates" ON public.series_fixed_rates;
CREATE POLICY "Admins and operations can read series_fixed_rates"
ON public.series_fixed_rates FOR SELECT TO authenticated
USING (public.has_role(auth.uid(), 'admin'::app_role) OR public.has_role(auth.uid(), 'operations'::app_role));

-- 3. staff_skills: restrict SELECT to authenticated only (remove anonymous access)
DROP POLICY IF EXISTS "Authenticated can read staff_skills" ON public.staff_skills;
CREATE POLICY "Authenticated users can read staff_skills"
ON public.staff_skills FOR SELECT TO authenticated
USING (true);

-- 4. Storage: drop overly permissive public listing SELECT policies
DO $$
DECLARE pol RECORD;
BEGIN
  FOR pol IN 
    SELECT policyname FROM pg_policies 
    WHERE schemaname = 'storage' AND tablename = 'objects' 
      AND cmd = 'SELECT'
      AND qual = 'true'
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON storage.objects', pol.policyname);
  END LOOP;
END $$;
