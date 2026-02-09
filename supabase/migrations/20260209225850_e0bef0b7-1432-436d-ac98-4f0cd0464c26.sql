-- Add 'assistant' to app_role enum
ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'assistant';

-- Update set_user_role to accept all current roles
CREATE OR REPLACE FUNCTION public.set_user_role(p_user_id uuid, p_role text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF NOT public.is_admin() THEN
    RETURN jsonb_build_object('success', false, 'error', 'Unauthorized');
  END IF;

  -- Validate role (updated to include photographer and assistant)
  IF p_role NOT IN ('admin', 'sales', 'operations', 'photographer', 'assistant') THEN
    RETURN jsonb_build_object('success', false, 'error', 'Invalid role');
  END IF;

  -- Prevent admin from changing their own role away from admin
  IF p_user_id = auth.uid() AND p_role != 'admin' THEN
    RETURN jsonb_build_object('success', false, 'error', 'Cannot change your own role');
  END IF;

  -- Upsert into user_roles
  INSERT INTO public.user_roles(user_id, role)
  VALUES (p_user_id, p_role::app_role)
  ON CONFLICT (user_id, role) DO NOTHING;

  -- Delete any other roles for this user (single role per user)
  DELETE FROM public.user_roles
  WHERE user_id = p_user_id AND role != p_role::app_role;

  RETURN jsonb_build_object('success', true);
END;
$$;