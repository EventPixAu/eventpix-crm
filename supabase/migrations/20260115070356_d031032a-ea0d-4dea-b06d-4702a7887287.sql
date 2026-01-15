-- Enable pgcrypto extension for gen_random_bytes
CREATE EXTENSION IF NOT EXISTS pgcrypto WITH SCHEMA extensions;

-- Update the generate_qr_token function to use pgcrypto from extensions schema
CREATE OR REPLACE FUNCTION public.generate_qr_token()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF NEW.qr_token IS NULL THEN
    NEW.qr_token := encode(extensions.gen_random_bytes(24), 'hex');
  END IF;
  RETURN NEW;
END;
$$;