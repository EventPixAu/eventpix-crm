CREATE OR REPLACE FUNCTION public.accept_quote_public(p_token text, p_name text, p_email text)
 RETURNS json
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_quote RECORD;
  v_result jsonb;
  v_attempts INTEGER;
  v_clean_name text;
  v_clean_email text;
BEGIN
  -- Validate name
  v_clean_name := trim(p_name);
  IF v_clean_name IS NULL OR length(v_clean_name) < 1 OR length(v_clean_name) > 200 THEN
    RETURN json_build_object('success', false, 'error', 'Name must be 1-200 characters');
  END IF;

  -- Validate email format and length
  v_clean_email := lower(trim(p_email));
  IF length(v_clean_email) > 255 THEN
    RETURN json_build_object('success', false, 'error', 'Email too long');
  END IF;
  IF v_clean_email !~ '^[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}$' THEN
    RETURN json_build_object('success', false, 'error', 'Invalid email format');
  END IF;

  -- Validate token
  IF p_token IS NULL OR length(p_token) < 10 OR length(p_token) > 256 THEN
    RETURN json_build_object('success', false, 'error', 'Invalid token');
  END IF;

  -- Get quote by public token
  SELECT id, status, lead_id, event_id INTO v_quote
  FROM public.quotes
  WHERE public_token = p_token;

  IF v_quote.id IS NULL THEN
    RETURN json_build_object('success', false, 'error', 'Quote not found or link expired');
  END IF;

  IF v_quote.status = 'accepted' THEN
    RETURN json_build_object('success', false, 'error', 'Quote already accepted');
  END IF;

  -- Rate limiting
  SELECT COUNT(*) INTO v_attempts
  FROM public.contract_acceptance_attempts
  WHERE public_token = p_token
    AND attempt_at > NOW() - INTERVAL '1 hour';
  IF v_attempts > 10 THEN
    RETURN json_build_object('success', false, 'error', 'Too many attempts. Please try again later.');
  END IF;

  -- Accept the quote using validated inputs - store result in separate variable
  v_result := public.accept_quote(v_quote.id, v_clean_name, v_clean_email);

  IF NOT COALESCE((v_result->>'success')::boolean, false) THEN
    RETURN json_build_object('success', false, 'error', COALESCE(v_result->>'error', 'Failed to accept quote'));
  END IF;

  RETURN json_build_object('success', true, 'quote_id', v_quote.id, 'accepted_at', now());
END;
$function$;