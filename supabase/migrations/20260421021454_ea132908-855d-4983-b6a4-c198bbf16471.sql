
-- 1. Staff: explicit admin/operations SELECT only (no public/crew read of sensitive PII)
DROP POLICY IF EXISTS "Authenticated read staff" ON public.staff;
DROP POLICY IF EXISTS "Anyone can view staff" ON public.staff;
DROP POLICY IF EXISTS "Staff readable by all authenticated" ON public.staff;

CREATE POLICY "Admins and operations can read staff"
ON public.staff FOR SELECT TO authenticated
USING (public.has_role(auth.uid(), 'admin'::app_role) OR public.has_role(auth.uid(), 'operations'::app_role));

-- 2. assignment_allowances: restrict SELECT to admin/operations
DROP POLICY IF EXISTS "Authenticated read assignment_allowances" ON public.assignment_allowances;

CREATE POLICY "Admins and operations can read assignment_allowances"
ON public.assignment_allowances FOR SELECT TO authenticated
USING (public.has_role(auth.uid(), 'admin'::app_role) OR public.has_role(auth.uid(), 'operations'::app_role));

-- 3. lead_statuses: restrict to authenticated only
DROP POLICY IF EXISTS "Anyone can read lead statuses" ON public.lead_statuses;

CREATE POLICY "Authenticated users can read lead statuses"
ON public.lead_statuses FOR SELECT TO authenticated
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
