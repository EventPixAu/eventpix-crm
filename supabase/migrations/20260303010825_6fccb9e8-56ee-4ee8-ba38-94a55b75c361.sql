
-- Add client portal token to events
ALTER TABLE public.events ADD COLUMN IF NOT EXISTS client_portal_token text UNIQUE;

-- Function to generate portal token
CREATE OR REPLACE FUNCTION public.generate_client_portal_token()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF NEW.client_portal_token IS NULL THEN
    NEW.client_portal_token := encode(extensions.gen_random_bytes(32), 'hex');
  END IF;
  RETURN NEW;
END;
$$;

-- Auto-generate token on insert
CREATE TRIGGER trg_generate_client_portal_token
BEFORE INSERT ON public.events
FOR EACH ROW
EXECUTE FUNCTION public.generate_client_portal_token();

-- Backfill existing events with tokens
UPDATE public.events
SET client_portal_token = encode(extensions.gen_random_bytes(32), 'hex')
WHERE client_portal_token IS NULL;
