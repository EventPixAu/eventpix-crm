
CREATE OR REPLACE FUNCTION public.current_user_role()
 RETURNS text
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $$
  SELECT 
    CASE 
      WHEN ur.role::text IN ('photographer', 'assistant') THEN 'crew'
      ELSE ur.role::text
    END
  FROM public.user_roles ur
  JOIN public.profiles p ON p.id = ur.user_id
  WHERE ur.user_id = auth.uid()
    AND COALESCE(p.is_active, true) = true
  ORDER BY 
    CASE ur.role
      WHEN 'admin' THEN 1
      WHEN 'operations' THEN 2
      WHEN 'sales' THEN 3
      WHEN 'executive' THEN 4
      WHEN 'crew' THEN 5
      WHEN 'photographer' THEN 5
      WHEN 'assistant' THEN 5
    END
  LIMIT 1
$$;
