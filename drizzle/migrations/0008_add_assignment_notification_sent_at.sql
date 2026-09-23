ALTER TABLE public.event_assignments
  ADD COLUMN IF NOT EXISTS notification_sent_at timestamptz;

COMMENT ON COLUMN public.event_assignments.notification_sent_at IS
  'Timestamp of the latest successfully sent assignment notification email.';