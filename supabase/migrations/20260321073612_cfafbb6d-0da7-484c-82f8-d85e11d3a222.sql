
ALTER TABLE public.event_series
ADD COLUMN IF NOT EXISTS default_contact_id uuid REFERENCES public.client_contacts(id) ON DELETE SET NULL;
