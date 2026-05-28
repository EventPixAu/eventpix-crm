ALTER TABLE public.event_series
ADD COLUMN IF NOT EXISTS additional_contact_ids uuid[] NOT NULL DEFAULT '{}'::uuid[];