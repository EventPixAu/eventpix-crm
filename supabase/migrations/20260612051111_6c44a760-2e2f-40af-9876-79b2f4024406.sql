ALTER TABLE public.client_contacts
  ADD COLUMN IF NOT EXISTS status text,
  ADD COLUMN IF NOT EXISTS category text;

CREATE INDEX IF NOT EXISTS idx_client_contacts_status ON public.client_contacts(status);
CREATE INDEX IF NOT EXISTS idx_client_contacts_category ON public.client_contacts(category);