-- Add tags column to clients table
ALTER TABLE public.clients ADD COLUMN IF NOT EXISTS tags text[] DEFAULT '{}';

-- Create index for tag searching
CREATE INDEX IF NOT EXISTS idx_clients_tags ON public.clients USING GIN(tags);