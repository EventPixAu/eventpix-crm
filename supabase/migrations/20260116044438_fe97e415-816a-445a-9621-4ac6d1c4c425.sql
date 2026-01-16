-- Fix: Restrict profile access to prevent PII exposure
-- Issue: All authenticated users can view complete staff profiles including sensitive PII

-- Drop the overly permissive policy
DROP POLICY IF EXISTS "Authenticated can view profiles" ON public.profiles;

-- Create restricted SELECT policies for profiles table
-- 1. Users can view their own profile
CREATE POLICY "Users can view own profile" ON public.profiles
  FOR SELECT USING (auth.uid() = id);

-- 2. Admins can view all profiles  
CREATE POLICY "Admins can view all profiles" ON public.profiles
  FOR SELECT USING (public.has_role(auth.uid(), 'admin'::app_role));

-- 3. Operations can view all profiles (needed for scheduling/coordination)
CREATE POLICY "Operations can view all profiles" ON public.profiles
  FOR SELECT USING (public.can_access_operations(auth.uid()));

-- 4. Sales can view basic profiles for client-staff matching
CREATE POLICY "Sales can view profiles" ON public.profiles
  FOR SELECT USING (public.can_access_sales(auth.uid()));

-- Create a limited view for general staff directory (team visibility)
-- This exposes ONLY non-sensitive fields needed for basic team awareness
CREATE OR REPLACE VIEW public.staff_directory 
WITH (security_invoker = true) AS
SELECT 
  id,
  full_name,
  avatar_url,
  default_role_id,
  status,
  is_active
FROM public.profiles
WHERE COALESCE(is_active, true) = true;

-- Grant SELECT on the view to authenticated users
GRANT SELECT ON public.staff_directory TO authenticated;

COMMENT ON VIEW public.staff_directory IS 'Limited staff directory view exposing only non-sensitive fields. Use this for team lists and assignment displays where full profile access is not needed.';