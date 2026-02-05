-- Update provision_user_invitation to accept new roles (photographer, assistant)
CREATE OR REPLACE FUNCTION public.provision_user_invitation(p_email text, p_role text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_id uuid;
  v_email text := lower(trim(p_email));
  v_existing_user uuid;
BEGIN
  IF NOT public.is_admin() THEN
    RETURN jsonb_build_object('success', false, 'error', 'Unauthorized');
  END IF;

  -- Updated role validation to include photographer and assistant (replacing crew)
  IF p_role NOT IN ('admin','sales','operations','photographer','assistant') THEN
    RETURN jsonb_build_object('success', false, 'error', 'Invalid role');
  END IF;

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
    -- Update existing invitation
    UPDATE public.user_invitations
    SET role = p_role,
        status = 'pending',
        error = NULL,
        updated_at = now()
    WHERE id = v_id;
    
    RETURN jsonb_build_object('success', true, 'invitation_id', v_id);
  END IF;

  -- Create new invitation
  INSERT INTO public.user_invitations(email, role, status, invited_by)
  VALUES (v_email, p_role, 'pending', auth.uid())
  RETURNING id INTO v_id;

  RETURN jsonb_build_object('success', true, 'invitation_id', v_id);
END;
$$;