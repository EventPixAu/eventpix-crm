-- Add tags column to client_contacts for Google Contacts labels
ALTER TABLE public.client_contacts 
ADD COLUMN IF NOT EXISTS tags text[] DEFAULT '{}';

-- Add an index for efficient tag-based queries
CREATE INDEX IF NOT EXISTS idx_client_contacts_tags ON public.client_contacts USING GIN(tags);