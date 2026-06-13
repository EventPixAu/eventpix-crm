
ALTER TABLE public.client_contacts
  ADD COLUMN IF NOT EXISTS bounce_status text,
  ADD COLUMN IF NOT EXISTS bounced_at timestamptz;

ALTER TABLE public.client_contacts
  DROP CONSTRAINT IF EXISTS client_contacts_bounce_status_check;
ALTER TABLE public.client_contacts
  ADD CONSTRAINT client_contacts_bounce_status_check
  CHECK (bounce_status IS NULL OR bounce_status IN ('bounced','complained'));

CREATE INDEX IF NOT EXISTS idx_client_contacts_bounce_status
  ON public.client_contacts(bounce_status) WHERE bounce_status IS NOT NULL;

ALTER TABLE public.contact_activities
  DROP CONSTRAINT IF EXISTS contact_activities_activity_type_check;
ALTER TABLE public.contact_activities
  ADD CONSTRAINT contact_activities_activity_type_check
  CHECK (activity_type = ANY (ARRAY[
    'email'::text,'phone_call'::text,'meeting'::text,
    'status_change'::text,'category_change'::text,
    'note'::text,'task'::text,'system'::text,'bounce'::text
  ]));
