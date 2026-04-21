
-- ============================================
-- 1. Restrict lead_files access to privileged roles
-- ============================================
DROP POLICY IF EXISTS "Authenticated users can view lead files" ON public.lead_files;
DROP POLICY IF EXISTS "Authenticated users can insert lead files" ON public.lead_files;
DROP POLICY IF EXISTS "Authenticated users can delete lead files" ON public.lead_files;
DROP POLICY IF EXISTS "Authenticated users can update lead files" ON public.lead_files;

CREATE POLICY "Privileged roles can view lead files"
ON public.lead_files
FOR SELECT
TO authenticated
USING (
  public.has_role(auth.uid(), 'admin'::app_role)
  OR public.has_role(auth.uid(), 'sales'::app_role)
  OR public.has_role(auth.uid(), 'operations'::app_role)
);

CREATE POLICY "Privileged roles can insert lead files"
ON public.lead_files
FOR INSERT
TO authenticated
WITH CHECK (
  public.has_role(auth.uid(), 'admin'::app_role)
  OR public.has_role(auth.uid(), 'sales'::app_role)
  OR public.has_role(auth.uid(), 'operations'::app_role)
);

CREATE POLICY "Privileged roles can delete lead files"
ON public.lead_files
FOR DELETE
TO authenticated
USING (
  public.has_role(auth.uid(), 'admin'::app_role)
  OR public.has_role(auth.uid(), 'sales'::app_role)
  OR public.has_role(auth.uid(), 'operations'::app_role)
);

-- Also harden the storage bucket policies for SELECT (view/download)
DROP POLICY IF EXISTS "Authenticated users can view lead files" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can read lead files" ON storage.objects;

CREATE POLICY "Privileged roles can view lead files"
ON storage.objects
FOR SELECT
TO authenticated
USING (
  bucket_id = 'lead-files'
  AND (
    public.has_role(auth.uid(), 'admin'::app_role)
    OR public.has_role(auth.uid(), 'sales'::app_role)
    OR public.has_role(auth.uid(), 'operations'::app_role)
  )
);

-- ============================================
-- 2. Restrict sensitive profile fields to admins only
-- ============================================
-- Drop existing broad SELECT policies on profiles
DROP POLICY IF EXISTS "Admins, ops, sales, executive can view all profiles" ON public.profiles;
DROP POLICY IF EXISTS "Admin and ops can view all profiles" ON public.profiles;
DROP POLICY IF EXISTS "Sales can view all profiles" ON public.profiles;
DROP POLICY IF EXISTS "Executive can view all profiles" ON public.profiles;
DROP POLICY IF EXISTS "Operations can view all profiles" ON public.profiles;
DROP POLICY IF EXISTS "Internal staff can view profiles" ON public.profiles;

-- Users can always view their own full profile
DROP POLICY IF EXISTS "Users can view their own profile" ON public.profiles;
CREATE POLICY "Users can view their own profile"
ON public.profiles
FOR SELECT
TO authenticated
USING (id = auth.uid());

-- Only admins can read full profile rows (including sensitive PII/financial fields)
CREATE POLICY "Admins can view all profile fields"
ON public.profiles
FOR SELECT
TO authenticated
USING (public.has_role(auth.uid(), 'admin'::app_role));

-- Operations, sales, and executive roles read non-sensitive identity fields via the
-- existing public.staff_directory view (which already excludes sensitive PII/financial
-- fields and is the canonical source for assignment dropdowns).
GRANT SELECT ON public.staff_directory TO authenticated;
