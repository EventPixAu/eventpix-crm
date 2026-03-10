
-- Add client_portal_token to leads table
ALTER TABLE public.leads ADD COLUMN IF NOT EXISTS client_portal_token TEXT;

-- Create trigger to auto-generate token on insert
CREATE OR REPLACE FUNCTION public.generate_lead_portal_token()
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

CREATE TRIGGER trg_generate_lead_portal_token
  BEFORE INSERT ON public.leads
  FOR EACH ROW
  EXECUTE FUNCTION public.generate_lead_portal_token();

-- Backfill only unconverted leads (to avoid lock_accepted_lead trigger)
UPDATE public.leads
SET client_portal_token = encode(extensions.gen_random_bytes(32), 'hex')
WHERE client_portal_token IS NULL
  AND converted_job_id IS NULL;
