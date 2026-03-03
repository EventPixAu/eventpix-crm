
-- Add client-facing event brief field
ALTER TABLE public.events ADD COLUMN IF NOT EXISTS client_brief_content text;

-- Add comment
COMMENT ON COLUMN public.events.client_brief_content IS 'Client-facing event brief shared on the client portal';
