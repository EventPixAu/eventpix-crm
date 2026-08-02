ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS first_login_at timestamptz,
  ADD COLUMN IF NOT EXISTS first_login_notified_at timestamptz,
  ADD COLUMN IF NOT EXISTS onboarding_submitted_at timestamptz,
  ADD COLUMN IF NOT EXISTS onboarding_submitted_notified_at timestamptz;