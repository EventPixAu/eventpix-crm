ALTER TABLE public.leads ADD COLUMN IF NOT EXISTS event_website TEXT;
ALTER TABLE public.events ADD COLUMN IF NOT EXISTS event_website TEXT;