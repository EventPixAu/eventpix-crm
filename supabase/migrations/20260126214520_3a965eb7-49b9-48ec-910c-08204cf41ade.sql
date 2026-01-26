-- Add calendar feed token to profiles for secure iCal subscription URLs
ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS calendar_feed_token text;

-- Create function to generate feed token if not exists
CREATE OR REPLACE FUNCTION public.ensure_calendar_feed_token()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF NEW.calendar_feed_token IS NULL THEN
    NEW.calendar_feed_token := encode(gen_random_bytes(32), 'hex');
  END IF;
  RETURN NEW;
END;
$$;

-- Trigger on insert
DROP TRIGGER IF EXISTS ensure_calendar_feed_token_trigger ON public.profiles;
CREATE TRIGGER ensure_calendar_feed_token_trigger
  BEFORE INSERT ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.ensure_calendar_feed_token();

-- Generate tokens for existing profiles without one
UPDATE public.profiles
SET calendar_feed_token = encode(gen_random_bytes(32), 'hex')
WHERE calendar_feed_token IS NULL;

-- Function to regenerate feed token (invalidates old subscriptions)
CREATE OR REPLACE FUNCTION public.regenerate_calendar_feed_token(p_user_id uuid)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_new_token text;
BEGIN
  -- Only allow users to regenerate their own token or admins
  IF auth.uid() != p_user_id AND NOT public.is_admin() THEN
    RAISE EXCEPTION 'Unauthorized';
  END IF;
  
  v_new_token := encode(gen_random_bytes(32), 'hex');
  
  UPDATE public.profiles
  SET calendar_feed_token = v_new_token
  WHERE id = p_user_id;
  
  RETURN v_new_token;
END;
$$;