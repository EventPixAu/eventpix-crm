-- =========================================
-- 1) USER INVITATIONS TABLE
-- =========================================
CREATE TABLE IF NOT EXISTS public.user_invitations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email text NOT NULL,
  role text NOT NULL CHECK (role IN ('admin','sales','operations','crew')),
  status text NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending','sent','accepted','expired','revoked','cancelled')),
  invited_by uuid NOT NULL REFERENCES public.profiles(id) ON DELETE RESTRICT,
  token text NOT NULL,
  expires_at timestamptz NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Create unique index for pending/sent invites per email
CREATE UNIQUE INDEX IF NOT EXISTS user_invitations_email_pending_idx 
ON public.user_invitations(email) 
WHERE status IN ('pending', 'sent');

ALTER TABLE public.user_invitations ENABLE ROW LEVEL SECURITY;

-- =========================================
-- 2) RLS POLICIES FOR INVITATIONS
-- =========================================
DROP POLICY IF EXISTS "Admin can manage invitations" ON public.user_invitations;
CREATE POLICY "Admin can manage invitations"
ON public.user_invitations
FOR ALL
TO authenticated
USING (public.is_admin())
WITH CHECK (public.is_admin());

-- =========================================
-- 3) RLS POLICY: Admin can view all profiles
-- =========================================
DROP POLICY IF EXISTS "Admin can view all profiles" ON public.profiles;
CREATE POLICY "Admin can view all profiles"
ON public.profiles
FOR SELECT
TO authenticated
USING (public.is_admin());

-- =========================================
-- 4) RPC: Create user invitation
-- =========================================
CREATE OR REPLACE FUNCTION public.create_user_invitation(p_email text, p_role text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_token text := encode(gen_random_bytes(24), 'base64');
  v_invite_id uuid;
  v_existing_user uuid;
BEGIN
  -- Check admin permission
  IF NOT public.is_admin() THEN
    RETURN jsonb_build_object('success', false, 'error', 'Unauthorized');
  END IF;

  -- Validate role
  IF p_role NOT IN ('admin', 'sales', 'operations', 'crew') THEN
    RETURN jsonb_build_object('success', false, 'error', 'Invalid role');
  END IF;

  -- Check if user already exists
  SELECT id INTO v_existing_user
  FROM public.profiles
  WHERE email = lower(trim(p_email));

  IF v_existing_user IS NOT NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'User already exists');
  END IF;

  -- Check for existing pending invite
  IF EXISTS (
    SELECT 1 FROM public.user_invitations
    WHERE email = lower(trim(p_email))
    AND status IN ('pending', 'sent')
  ) THEN
    RETURN jsonb_build_object('success', false, 'error', 'Pending invitation already exists for this email');
  END IF;

  -- Create invitation
  INSERT INTO public.user_invitations(email, role, status, invited_by, token, expires_at)
  VALUES (
    lower(trim(p_email)),
    p_role,
    'pending',
    auth.uid(),
    v_token,
    now() + interval '14 days'
  )
  RETURNING id INTO v_invite_id;

  RETURN jsonb_build_object(
    'success', true,
    'invitation_id', v_invite_id,
    'token', v_token
  );
END;
$$;

-- =========================================
-- 5) RPC: Set user active/inactive
-- =========================================
CREATE OR REPLACE FUNCTION public.set_user_active(p_user_id uuid, p_is_active boolean)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  IF NOT public.is_admin() THEN
    RETURN jsonb_build_object('success', false, 'error', 'Unauthorized');
  END IF;

  -- Prevent admin from deactivating themselves
  IF p_user_id = auth.uid() AND p_is_active = false THEN
    RETURN jsonb_build_object('success', false, 'error', 'Cannot deactivate yourself');
  END IF;

  UPDATE public.profiles
  SET is_active = p_is_active, updated_at = now()
  WHERE id = p_user_id;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'User not found');
  END IF;

  RETURN jsonb_build_object('success', true);
END;
$$;

-- =========================================
-- 6) RPC: Set user role (updates user_roles table)
-- =========================================
CREATE OR REPLACE FUNCTION public.set_user_role(p_user_id uuid, p_role text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  IF NOT public.is_admin() THEN
    RETURN jsonb_build_object('success', false, 'error', 'Unauthorized');
  END IF;

  -- Validate role
  IF p_role NOT IN ('admin', 'sales', 'operations', 'crew') THEN
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

-- =========================================
-- 7) RPC: Accept invitation
-- =========================================
CREATE OR REPLACE FUNCTION public.accept_invitation(p_token text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_invite record;
  v_user_id uuid := auth.uid();
BEGIN
  -- Must be authenticated
  IF v_user_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Not authenticated');
  END IF;

  -- Find valid invitation
  SELECT * INTO v_invite
  FROM public.user_invitations
  WHERE token = p_token
  AND status IN ('pending', 'sent')
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Invalid or expired invitation');
  END IF;

  -- Check expiry
  IF v_invite.expires_at < now() THEN
    UPDATE public.user_invitations
    SET status = 'expired', updated_at = now()
    WHERE id = v_invite.id;
    RETURN jsonb_build_object('success', false, 'error', 'Invitation has expired');
  END IF;

  -- Create or update profile
  INSERT INTO public.profiles(id, email, is_active, created_at, updated_at)
  VALUES (v_user_id, v_invite.email, true, now(), now())
  ON CONFLICT (id) DO UPDATE
  SET email = v_invite.email, is_active = true, updated_at = now();

  -- Set role in user_roles table
  INSERT INTO public.user_roles(user_id, role)
  VALUES (v_user_id, v_invite.role::app_role)
  ON CONFLICT (user_id, role) DO NOTHING;

  -- Delete any other roles (single role per user)
  DELETE FROM public.user_roles
  WHERE user_id = v_user_id AND role != v_invite.role::app_role;

  -- Mark invitation as accepted
  UPDATE public.user_invitations
  SET status = 'accepted', updated_at = now()
  WHERE id = v_invite.id;

  RETURN jsonb_build_object(
    'success', true,
    'role', v_invite.role
  );
END;
$$;

-- =========================================
-- 8) RPC: Resend invitation (reset expiry)
-- =========================================
CREATE OR REPLACE FUNCTION public.resend_invitation(p_invitation_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_new_token text := encode(gen_random_bytes(24), 'base64');
BEGIN
  IF NOT public.is_admin() THEN
    RETURN jsonb_build_object('success', false, 'error', 'Unauthorized');
  END IF;

  UPDATE public.user_invitations
  SET 
    token = v_new_token,
    status = 'sent',
    expires_at = now() + interval '14 days',
    updated_at = now()
  WHERE id = p_invitation_id
  AND status IN ('pending', 'sent', 'expired');

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Invitation not found or cannot be resent');
  END IF;

  RETURN jsonb_build_object(
    'success', true,
    'token', v_new_token
  );
END;
$$;

-- =========================================
-- 9) RPC: Revoke invitation
-- =========================================
CREATE OR REPLACE FUNCTION public.revoke_invitation(p_invitation_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  IF NOT public.is_admin() THEN
    RETURN jsonb_build_object('success', false, 'error', 'Unauthorized');
  END IF;

  UPDATE public.user_invitations
  SET status = 'revoked', updated_at = now()
  WHERE id = p_invitation_id
  AND status IN ('pending', 'sent');

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Invitation not found or already processed');
  END IF;

  RETURN jsonb_build_object('success', true);
END;
$$;