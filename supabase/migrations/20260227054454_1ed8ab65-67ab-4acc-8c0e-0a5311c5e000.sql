
-- Update provision_user_invitation to map non-system roles to crew
CREATE OR REPLACE FUNCTION public.provision_user_invitation(p_email text, p_role text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_id uuid;
  v_email text := lower(trim(p_email));
  v_existing_user uuid;
  v_mapped_role text;
BEGIN
  IF NOT public.is_admin() THEN
    RETURN jsonb_build_object('success', false, 'error', 'Unauthorized');
  END IF;

  -- Map staff role names to system app_role values
  v_mapped_role := CASE lower(p_role)
    WHEN 'admin' THEN 'admin'
    WHEN 'sales' THEN 'sales'
    WHEN 'operations' THEN 'operations'
    WHEN 'photographer' THEN 'photographer'
    WHEN 'assistant' THEN 'assistant'
    WHEN 'crew' THEN 'crew'
    WHEN 'executive' THEN 'executive'
    ELSE 'crew'  -- Map any other staff role (e.g. videographer) to crew
  END;

  -- Check if user already exists in profiles
  SELECT id INTO v_existing_user
  FROM public.profiles
  WHERE email = v_email;

  IF v_existing_user IS NOT NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'User already exists');
  END IF;

  -- Check for existing active invitation
  SELECT id INTO v_id
  FROM public.user_invitations
  WHERE lower(email) = v_email
    AND status NOT IN ('revoked', 'failed');

  IF v_id IS NOT NULL THEN
    UPDATE public.user_invitations
    SET role = v_mapped_role,
        status = 'pending',
        error = NULL,
        updated_at = now()
    WHERE id = v_id;
    
    RETURN jsonb_build_object('success', true, 'invitation_id', v_id);
  END IF;

  INSERT INTO public.user_invitations(email, role, status, invited_by)
  VALUES (v_email, v_mapped_role, 'pending', auth.uid())
  RETURNING id INTO v_id;

  RETURN jsonb_build_object('success', true, 'invitation_id', v_id);
END;
$function$;

-- Update set_user_role to map non-system roles to crew
CREATE OR REPLACE FUNCTION public.set_user_role(p_user_id uuid, p_role text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_mapped_role text;
BEGIN
  IF NOT public.is_admin() THEN
    RETURN jsonb_build_object('success', false, 'error', 'Unauthorized');
  END IF;

  -- Map staff role names to system app_role values
  v_mapped_role := CASE lower(p_role)
    WHEN 'admin' THEN 'admin'
    WHEN 'sales' THEN 'sales'
    WHEN 'operations' THEN 'operations'
    WHEN 'photographer' THEN 'photographer'
    WHEN 'assistant' THEN 'assistant'
    WHEN 'crew' THEN 'crew'
    WHEN 'executive' THEN 'executive'
    ELSE 'crew'  -- Map any other staff role (e.g. videographer) to crew
  END;

  -- Prevent admin from changing their own role away from admin
  IF p_user_id = auth.uid() AND v_mapped_role != 'admin' THEN
    RETURN jsonb_build_object('success', false, 'error', 'Cannot change your own role');
  END IF;

  -- Upsert into user_roles
  INSERT INTO public.user_roles(user_id, role)
  VALUES (p_user_id, v_mapped_role::app_role)
  ON CONFLICT (user_id, role) DO NOTHING;

  -- Delete any other roles for this user (single role per user)
  DELETE FROM public.user_roles
  WHERE user_id = p_user_id AND role != v_mapped_role::app_role;

  RETURN jsonb_build_object('success', true);
END;
$function$;
