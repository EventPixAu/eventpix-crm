
-- Add source column to client_contacts table
ALTER TABLE public.client_contacts
ADD COLUMN source TEXT DEFAULT NULL;

-- Add comment for documentation
COMMENT ON COLUMN public.client_contacts.source IS 'Origin/import source of the contact (e.g., Studio Ninja, Google Contacts, Manual)';

-- Tag the 801 contacts imported on 2026-01-26 (05:00-07:00 UTC) as Studio Ninja imports
UPDATE public.client_contacts
SET source = 'Studio Ninja'
WHERE created_at >= '2026-01-26 05:00:00+00'
  AND created_at < '2026-01-26 07:00:00+00';
