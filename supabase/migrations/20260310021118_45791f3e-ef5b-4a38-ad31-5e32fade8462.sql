
CREATE OR REPLACE FUNCTION public.is_crew(_user_id uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id
    AND role IN ('crew'::app_role, 'photographer'::app_role, 'assistant'::app_role)
  )
$$;

CREATE OR REPLACE FUNCTION public.is_crew()
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $$
  SELECT public.is_crew(auth.uid())
$$;
