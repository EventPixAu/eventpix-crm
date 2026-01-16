-- Update user_invitations table with new schema for admin-created accounts
ALTER TABLE IF EXISTS public.user_invitations DROP CONSTRAINT IF EXISTS user_invitations_email_status_key;
ALTER TABLE IF EXISTS public.user_invitations DROP COLUMN IF EXISTS token;
ALTER TABLE IF EXISTS public.user_invitations DROP COLUMN IF EXISTS expires_at;

ALTER TABLE public.user_invitations 
  ADD COLUMN IF NOT EXISTS auth_user_id uuid NULL,
  ADD COLUMN IF NOT EXISTS error text NULL;

-- Update status constraint for new statuses
ALTER TABLE public.user_invitations DROP CONSTRAINT IF EXISTS user_invitations_status_check;
ALTER TABLE public.user_invitations ADD CONSTRAINT user_invitations_status_check 
  CHECK (status IN ('pending','provisioned','emailed','accepted','revoked','failed'));

-- Add unique constraint on lowercase email
DROP INDEX IF EXISTS user_invitations_email_unique_idx;
CREATE UNIQUE INDEX user_invitations_email_unique_idx ON public.user_invitations (lower(email)) 
  WHERE status NOT IN ('revoked', 'failed');

-- Add is_active column to profiles if missing
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS is_active boolean DEFAULT true;

-- Update current_user_role to check is_active status
CREATE OR REPLACE FUNCTION public.current_user_role()
RETURNS text
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT ur.role::text
  FROM public.user_roles ur
  JOIN public.profiles p ON p.id = ur.user_id
  WHERE ur.user_id = auth.uid()
    AND COALESCE(p.is_active, true) = true
  LIMIT 1
$$;

-- Provision invitation RPC (creates invitation record)
CREATE OR REPLACE FUNCTION public.provision_user_invitation(p_email text, p_role text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_id uuid;
  v_email text := lower(trim(p_email));
  v_existing_user uuid;
BEGIN
  IF NOT public.is_admin() THEN
    RETURN jsonb_build_object('success', false, 'error', 'Unauthorized');
  END IF;

  IF p_role NOT IN ('admin','sales','operations','crew') THEN
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

-- Mark invitation as failed
CREATE OR REPLACE FUNCTION public.mark_invitation_failed(p_invitation_id uuid, p_error text, p_auth_user_id uuid DEFAULT NULL)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  UPDATE public.user_invitations
  SET status = 'failed',
      error = p_error,
      auth_user_id = p_auth_user_id,
      updated_at = now()
  WHERE id = p_invitation_id;
END;
$$;

-- Mark invitation as emailed (called by edge function)
CREATE OR REPLACE FUNCTION public.mark_invitation_emailed(p_invitation_id uuid, p_auth_user_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  UPDATE public.user_invitations
  SET status = 'emailed',
      auth_user_id = p_auth_user_id,
      error = NULL,
      updated_at = now()
  WHERE id = p_invitation_id;
END;
$$;

-- Drop old functions that won't be used
DROP FUNCTION IF EXISTS public.create_user_invitation(text, text);
DROP FUNCTION IF EXISTS public.resend_invitation(uuid);
DROP FUNCTION IF EXISTS public.accept_invitation(text);