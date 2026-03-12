
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  -- Skip profile creation for magic-link / OTP signups (client portal users).
  -- Team members are provisioned via admin-create-user which uses 'email' provider.
  -- Magic-link logins come through as provider = 'email' too, but they lack an
  -- existing invitation record. We detect client-portal OTP users by checking
  -- if there is NO matching invitation for this email. If no invitation exists,
  -- this is a client logging in via the portal — do NOT create a profile.
  IF NOT EXISTS (
    SELECT 1 FROM public.user_invitations
    WHERE LOWER(email) = LOWER(NEW.email)
  ) THEN
    -- Not an invited team member — skip profile creation
    RETURN NEW;
  END IF;

  INSERT INTO public.profiles (id, email, full_name)
  VALUES (NEW.id, NEW.email, NEW.raw_user_meta_data ->> 'full_name');
  RETURN NEW;
END;
$$;
