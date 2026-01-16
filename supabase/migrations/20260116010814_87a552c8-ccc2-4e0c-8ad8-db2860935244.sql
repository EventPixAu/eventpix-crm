-- Add new audit_action enum values for high-risk actions
ALTER TYPE public.audit_action ADD VALUE IF NOT EXISTS 'quote_token_regenerated';
ALTER TYPE public.audit_action ADD VALUE IF NOT EXISTS 'contract_token_regenerated';
ALTER TYPE public.audit_action ADD VALUE IF NOT EXISTS 'quote_accepted_public';
ALTER TYPE public.audit_action ADD VALUE IF NOT EXISTS 'quote_acceptance_failed';
ALTER TYPE public.audit_action ADD VALUE IF NOT EXISTS 'contract_accepted_public';
ALTER TYPE public.audit_action ADD VALUE IF NOT EXISTS 'contract_acceptance_failed';
ALTER TYPE public.audit_action ADD VALUE IF NOT EXISTS 'bulk_update';
ALTER TYPE public.audit_action ADD VALUE IF NOT EXISTS 'note_added';

-- Update regenerate_quote_token to use specific action
CREATE OR REPLACE FUNCTION public.regenerate_quote_token(p_quote_id uuid)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
DECLARE
  v_old_token text;
  v_new_token text;
BEGIN
  -- Check caller has sales access
  IF NOT public.can_access_sales(auth.uid()) THEN
    -- Log failed attempt
    INSERT INTO public.audit_log (action, actor_user_id, event_id, before, after)
    VALUES (
      'quote_token_regenerated',
      auth.uid(),
      NULL,
      jsonb_build_object('quote_id', p_quote_id),
      jsonb_build_object('success', false, 'reason', 'Access denied')
    );
    RETURN json_build_object('success', false, 'error', 'Access denied');
  END IF;
  
  -- Get old token
  SELECT public_token INTO v_old_token
  FROM public.quotes
  WHERE id = p_quote_id;
  
  IF v_old_token IS NULL THEN
    -- Log failed attempt - quote not found
    INSERT INTO public.audit_log (action, actor_user_id, event_id, before, after)
    VALUES (
      'quote_token_regenerated',
      auth.uid(),
      NULL,
      jsonb_build_object('quote_id', p_quote_id),
      jsonb_build_object('success', false, 'reason', 'Quote not found')
    );
    RETURN json_build_object('success', false, 'error', 'Quote not found');
  END IF;
  
  -- Generate new token
  v_new_token := encode(gen_random_bytes(32), 'hex');
  
  -- Update quote with new token
  UPDATE public.quotes
  SET public_token = v_new_token,
      updated_at = now()
  WHERE id = p_quote_id;
  
  -- Log success (never log actual tokens)
  INSERT INTO public.audit_log (action, actor_user_id, event_id, before, after)
  VALUES (
    'quote_token_regenerated',
    auth.uid(),
    NULL,
    jsonb_build_object('quote_id', p_quote_id, 'had_previous_token', true),
    jsonb_build_object('success', true, 'token_regenerated', true)
  );
  
  RETURN json_build_object('success', true, 'new_token', v_new_token);
END;
$function$;

-- Update regenerate_contract_token to use specific action and log failures
CREATE OR REPLACE FUNCTION public.regenerate_contract_token(p_contract_id uuid)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
DECLARE
  v_old_token text;
  v_new_token text;
  v_status text;
BEGIN
  -- Check caller has sales access
  IF NOT public.can_access_sales(auth.uid()) THEN
    INSERT INTO public.audit_log (action, actor_user_id, event_id, before, after)
    VALUES (
      'contract_token_regenerated',
      auth.uid(),
      NULL,
      jsonb_build_object('contract_id', p_contract_id),
      jsonb_build_object('success', false, 'reason', 'Access denied')
    );
    RETURN json_build_object('success', false, 'error', 'Access denied');
  END IF;
  
  -- Get old token and status
  SELECT public_token, status INTO v_old_token, v_status
  FROM public.contracts
  WHERE id = p_contract_id;
  
  IF v_old_token IS NULL THEN
    INSERT INTO public.audit_log (action, actor_user_id, event_id, before, after)
    VALUES (
      'contract_token_regenerated',
      auth.uid(),
      NULL,
      jsonb_build_object('contract_id', p_contract_id),
      jsonb_build_object('success', false, 'reason', 'Contract not found')
    );
    RETURN json_build_object('success', false, 'error', 'Contract not found');
  END IF;
  
  IF v_status = 'signed' THEN
    INSERT INTO public.audit_log (action, actor_user_id, event_id, before, after)
    VALUES (
      'contract_token_regenerated',
      auth.uid(),
      NULL,
      jsonb_build_object('contract_id', p_contract_id, 'status', v_status),
      jsonb_build_object('success', false, 'reason', 'Contract already signed')
    );
    RETURN json_build_object('success', false, 'error', 'Cannot regenerate token for signed contract');
  END IF;
  
  -- Generate new token
  v_new_token := encode(gen_random_bytes(32), 'hex');
  
  -- Update contract with new token
  UPDATE public.contracts
  SET public_token = v_new_token,
      updated_at = now()
  WHERE id = p_contract_id;
  
  -- Log success
  INSERT INTO public.audit_log (action, actor_user_id, event_id, before, after)
  VALUES (
    'contract_token_regenerated',
    auth.uid(),
    NULL,
    jsonb_build_object('contract_id', p_contract_id, 'had_previous_token', true),
    jsonb_build_object('success', true, 'token_regenerated', true)
  );
  
  RETURN json_build_object('success', true, 'new_token', v_new_token);
END;
$function$;

-- Update accept_quote_public to audit all outcomes
CREATE OR REPLACE FUNCTION public.accept_quote_public(p_token text, p_name text, p_email text)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
DECLARE
  v_quote_id uuid;
  v_quote_status text;
  v_recent_attempts int;
BEGIN
  -- Rate limiting: Check attempts in last hour
  SELECT COUNT(*) INTO v_recent_attempts
  FROM public.quote_acceptance_attempts
  WHERE public_token = p_token
    AND attempt_at > now() - interval '1 hour'
    AND NOT success;
  
  IF v_recent_attempts >= 10 THEN
    -- Log the blocked attempt
    INSERT INTO public.quote_acceptance_attempts (public_token, success)
    VALUES (p_token, false);
    
    -- Audit rate limit triggered (no quote_id to avoid enumeration)
    INSERT INTO public.audit_log (action, actor_user_id, event_id, before, after)
    VALUES (
      'quote_acceptance_failed',
      NULL,
      NULL,
      NULL,
      jsonb_build_object('reason', 'rate_limit_exceeded', 'accepted_by_name', p_name, 'accepted_by_email', p_email)
    );
    
    RETURN json_build_object('success', false, 'error', 'Too many attempts. Please try again later.');
  END IF;
  
  -- Get quote by token
  SELECT id, status INTO v_quote_id, v_quote_status
  FROM public.quotes
  WHERE public_token = p_token;
  
  IF v_quote_id IS NULL THEN
    -- Log failed attempt
    INSERT INTO public.quote_acceptance_attempts (public_token, success)
    VALUES (p_token, false);
    
    -- Audit failed - don't expose that token wasn't found
    INSERT INTO public.audit_log (action, actor_user_id, event_id, before, after)
    VALUES (
      'quote_acceptance_failed',
      NULL,
      NULL,
      NULL,
      jsonb_build_object('reason', 'invalid_token', 'accepted_by_name', p_name, 'accepted_by_email', p_email)
    );
    
    RETURN json_build_object('success', false, 'error', 'Quote not found');
  END IF;
  
  -- Idempotent check: Already accepted
  IF v_quote_status = 'accepted' THEN
    INSERT INTO public.audit_log (action, actor_user_id, event_id, before, after)
    VALUES (
      'quote_acceptance_failed',
      NULL,
      NULL,
      jsonb_build_object('quote_id', v_quote_id),
      jsonb_build_object('reason', 'already_accepted', 'accepted_by_name', p_name, 'accepted_by_email', p_email)
    );
    RETURN json_build_object('success', false, 'error', 'This quote has already been accepted');
  END IF;
  
  -- Check if quote is in valid state
  IF v_quote_status NOT IN ('draft', 'sent') THEN
    INSERT INTO public.quote_acceptance_attempts (public_token, success)
    VALUES (p_token, false);
    
    INSERT INTO public.audit_log (action, actor_user_id, event_id, before, after)
    VALUES (
      'quote_acceptance_failed',
      NULL,
      NULL,
      jsonb_build_object('quote_id', v_quote_id, 'status', v_quote_status),
      jsonb_build_object('reason', 'invalid_status', 'accepted_by_name', p_name, 'accepted_by_email', p_email)
    );
    
    RETURN json_build_object('success', false, 'error', 'Quote is not available for acceptance');
  END IF;
  
  -- Accept the quote
  UPDATE public.quotes
  SET status = 'accepted',
      accepted_at = now(),
      accepted_by_name = p_name,
      accepted_by_email = p_email,
      updated_at = now()
  WHERE id = v_quote_id;
  
  -- Update lead status if exists
  UPDATE public.leads
  SET status = 'accepted',
      updated_at = now()
  WHERE id = (SELECT lead_id FROM public.quotes WHERE id = v_quote_id);
  
  -- Log successful attempt
  INSERT INTO public.quote_acceptance_attempts (public_token, success)
  VALUES (p_token, true);
  
  -- Audit success (no secrets/tokens logged)
  INSERT INTO public.audit_log (action, actor_user_id, event_id, before, after)
  VALUES (
    'quote_accepted_public',
    NULL,
    NULL,
    jsonb_build_object('quote_id', v_quote_id, 'previous_status', v_quote_status),
    jsonb_build_object('accepted_by_name', p_name, 'accepted_by_email', p_email, 'accepted_at', now())
  );
  
  -- Return success WITHOUT exposing quote_id
  RETURN json_build_object('success', true);
END;
$function$;

-- Update accept_contract_public to audit all outcomes
CREATE OR REPLACE FUNCTION public.accept_contract_public(p_token text, p_name text, p_email text)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
DECLARE
  v_contract_id uuid;
  v_contract_status text;
  v_recent_attempts int;
BEGIN
  -- Rate limiting: Check attempts in last hour
  SELECT COUNT(*) INTO v_recent_attempts
  FROM public.contract_acceptance_attempts
  WHERE public_token = p_token
    AND attempt_at > now() - interval '1 hour'
    AND NOT success;
  
  IF v_recent_attempts >= 10 THEN
    INSERT INTO public.contract_acceptance_attempts (public_token, success)
    VALUES (p_token, false);
    
    INSERT INTO public.audit_log (action, actor_user_id, event_id, before, after)
    VALUES (
      'contract_acceptance_failed',
      NULL,
      NULL,
      NULL,
      jsonb_build_object('reason', 'rate_limit_exceeded', 'signed_by_name', p_name, 'signed_by_email', p_email)
    );
    
    RETURN json_build_object('success', false, 'error', 'Too many attempts. Please try again later.');
  END IF;
  
  -- Get contract by token
  SELECT id, status INTO v_contract_id, v_contract_status
  FROM public.contracts
  WHERE public_token = p_token;
  
  IF v_contract_id IS NULL THEN
    INSERT INTO public.contract_acceptance_attempts (public_token, success)
    VALUES (p_token, false);
    
    INSERT INTO public.audit_log (action, actor_user_id, event_id, before, after)
    VALUES (
      'contract_acceptance_failed',
      NULL,
      NULL,
      NULL,
      jsonb_build_object('reason', 'invalid_token', 'signed_by_name', p_name, 'signed_by_email', p_email)
    );
    
    RETURN json_build_object('success', false, 'error', 'Contract not found');
  END IF;
  
  -- Idempotent check: Already signed
  IF v_contract_status = 'signed' THEN
    INSERT INTO public.audit_log (action, actor_user_id, event_id, before, after)
    VALUES (
      'contract_acceptance_failed',
      NULL,
      NULL,
      jsonb_build_object('contract_id', v_contract_id),
      jsonb_build_object('reason', 'already_signed', 'signed_by_name', p_name, 'signed_by_email', p_email)
    );
    RETURN json_build_object('success', false, 'error', 'This contract has already been signed');
  END IF;
  
  -- Check if contract is in valid state
  IF v_contract_status NOT IN ('draft', 'sent') THEN
    INSERT INTO public.contract_acceptance_attempts (public_token, success)
    VALUES (p_token, false);
    
    INSERT INTO public.audit_log (action, actor_user_id, event_id, before, after)
    VALUES (
      'contract_acceptance_failed',
      NULL,
      NULL,
      jsonb_build_object('contract_id', v_contract_id, 'status', v_contract_status),
      jsonb_build_object('reason', 'invalid_status', 'signed_by_name', p_name, 'signed_by_email', p_email)
    );
    
    RETURN json_build_object('success', false, 'error', 'Contract is not available for signing');
  END IF;
  
  -- Sign the contract
  UPDATE public.contracts
  SET status = 'signed',
      signed_at = now(),
      signed_by_name = p_name,
      signed_by_email = p_email,
      updated_at = now()
  WHERE id = v_contract_id;
  
  -- Log successful attempt
  INSERT INTO public.contract_acceptance_attempts (public_token, success)
  VALUES (p_token, true);
  
  -- Audit success
  INSERT INTO public.audit_log (action, actor_user_id, event_id, before, after)
  VALUES (
    'contract_accepted_public',
    NULL,
    NULL,
    jsonb_build_object('contract_id', v_contract_id, 'previous_status', v_contract_status),
    jsonb_build_object('signed_by_name', p_name, 'signed_by_email', p_email, 'signed_at', now())
  );
  
  RETURN json_build_object('success', true);
END;
$function$;

-- Add index for audit_log performance queries
CREATE INDEX IF NOT EXISTS idx_audit_log_action ON public.audit_log(action);
CREATE INDEX IF NOT EXISTS idx_audit_log_created_at ON public.audit_log(created_at DESC);