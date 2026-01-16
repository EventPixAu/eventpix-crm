-- =========================================
-- NO-ARGUMENT HELPER FUNCTIONS FOR RLS
-- These wrap the existing functions with auth.uid()
-- =========================================

-- Current user's role (NULL if missing)
CREATE OR REPLACE FUNCTION public.current_user_role()
RETURNS text
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT ur.role::text
  FROM public.user_roles ur
  WHERE ur.user_id = auth.uid()
  LIMIT 1
$$;

-- No-argument is_admin (uses auth.uid())
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT public.has_role(auth.uid(), 'admin'::app_role)
$$;

-- No-argument is_sales (uses auth.uid())
CREATE OR REPLACE FUNCTION public.is_sales()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT public.has_role(auth.uid(), 'sales'::app_role)
$$;

-- No-argument is_operations (uses auth.uid())
CREATE OR REPLACE FUNCTION public.is_operations()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT public.has_role(auth.uid(), 'operations'::app_role)
$$;

-- No-argument is_crew (uses auth.uid())
CREATE OR REPLACE FUNCTION public.is_crew()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT public.has_role(auth.uid(), 'crew'::app_role)
$$;

-- No-argument is_assigned_to_event (for RLS policies on events table using id column)
CREATE OR REPLACE FUNCTION public.is_assigned_to_event(p_event_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT public.is_assigned_to_event(auth.uid(), p_event_id)
$$;

-- =========================================
-- UPDATE EVENT_ASSIGNMENTS POLICIES
-- Add crew update policy for acceptance status
-- =========================================

-- Drop existing crew update policy if exists and recreate
DROP POLICY IF EXISTS "Crew can update own assignment status" ON public.event_assignments;

CREATE POLICY "Crew can update own assignment status"
ON public.event_assignments
FOR UPDATE
TO authenticated
USING (
  public.is_crew()
  AND user_id = auth.uid()
)
WITH CHECK (
  public.is_crew()
  AND user_id = auth.uid()
);

-- =========================================
-- PROFILES TABLE POLICY UPDATES
-- Ensure users can read their own profile
-- =========================================

-- Allow any authenticated user to read their own profile
DROP POLICY IF EXISTS "Users can read own profile" ON public.profiles;
CREATE POLICY "Users can read own profile"
ON public.profiles
FOR SELECT
TO authenticated
USING (id = auth.uid());