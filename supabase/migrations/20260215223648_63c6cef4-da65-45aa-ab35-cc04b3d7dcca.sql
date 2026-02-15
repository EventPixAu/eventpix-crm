-- Fix 1: Make lead-files bucket private
UPDATE storage.buckets 
SET public = false 
WHERE id = 'lead-files';

-- Update storage policies: remove public access, require authenticated admin/sales
DROP POLICY IF EXISTS "Anyone can view lead files" ON storage.objects;

CREATE POLICY "Authenticated admin/sales can view lead files" 
ON storage.objects FOR SELECT
USING (
  bucket_id = 'lead-files' 
  AND auth.uid() IS NOT NULL
  AND (
    public.has_role(auth.uid(), 'admin')
    OR public.has_role(auth.uid(), 'sales')
    OR public.has_role(auth.uid(), 'operations')
  )
);

-- Fix 2: Add input validation to accept_quote_public
CREATE OR REPLACE FUNCTION public.accept_quote_public(p_token text, p_name text, p_email text)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_quote RECORD;
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

  -- Accept the quote using validated inputs
  SELECT * FROM public.accept_quote(v_quote.id, v_clean_name, v_clean_email) INTO v_quote;

  RETURN json_build_object('success', true, 'quote_id', v_quote.id, 'accepted_at', now());
END;
$$;

-- Fix 3: Add input validation to accept_contract_public
CREATE OR REPLACE FUNCTION public.accept_contract_public(p_token text, p_name text, p_email text, p_signature_data text DEFAULT NULL)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public', 'pg_temp'
AS $$
DECLARE
  v_contract RECORD;
  v_attempts INTEGER;
  v_clean_name text;
  v_clean_email text;
BEGIN
  -- Validate name
  v_clean_name := trim(p_name);
  IF v_clean_name IS NULL OR length(v_clean_name) < 1 OR length(v_clean_name) > 200 THEN
    RETURN jsonb_build_object('success', false, 'error', 'Name must be 1-200 characters');
  END IF;

  -- Validate email format and length
  v_clean_email := lower(trim(p_email));
  IF length(v_clean_email) > 255 THEN
    RETURN jsonb_build_object('success', false, 'error', 'Email too long');
  END IF;
  IF v_clean_email !~ '^[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}$' THEN
    RETURN jsonb_build_object('success', false, 'error', 'Invalid email format');
  END IF;

  -- Validate token
  IF p_token IS NULL OR length(p_token) < 10 OR length(p_token) > 256 THEN
    RETURN jsonb_build_object('success', false, 'error', 'Invalid token');
  END IF;

  -- Validate signature data length if provided
  IF p_signature_data IS NOT NULL AND length(p_signature_data) > 500000 THEN
    RETURN jsonb_build_object('success', false, 'error', 'Signature data too large');
  END IF;

  -- Get contract by public token
  SELECT id, status, lead_id, event_id, quote_id INTO v_contract
  FROM public.contracts
  WHERE public_token = p_token;
  
  IF v_contract.id IS NULL THEN
    INSERT INTO public.contract_acceptance_attempts (public_token, success)
    VALUES (p_token, false);
    RETURN jsonb_build_object('success', false, 'error', 'Contract not found or link expired');
  END IF;
  
  IF v_contract.status = 'signed' THEN
    RETURN jsonb_build_object('success', false, 'error', 'Contract already signed');
  END IF;
  
  IF v_contract.status = 'cancelled' THEN
    RETURN jsonb_build_object('success', false, 'error', 'Contract has been cancelled');
  END IF;
  
  -- Rate limiting
  SELECT COUNT(*) INTO v_attempts
  FROM public.contract_acceptance_attempts
  WHERE public_token = p_token
    AND attempt_at > NOW() - INTERVAL '1 hour';
    
  IF v_attempts > 10 THEN
    RETURN jsonb_build_object('success', false, 'error', 'Too many attempts. Please try again later.');
  END IF;
  
  -- Update contract to signed status using validated inputs
  UPDATE public.contracts
  SET 
    status = 'signed',
    signed_at = NOW(),
    signed_by_name = v_clean_name,
    signed_by_email = v_clean_email,
    signature_data = p_signature_data,
    updated_at = NOW()
  WHERE id = v_contract.id;
  
  -- Log successful attempt
  INSERT INTO public.contract_acceptance_attempts (public_token, success)
  VALUES (p_token, true);
  
  -- Trigger workflow automation if contract has a lead
  IF v_contract.lead_id IS NOT NULL THEN
    PERFORM public.auto_complete_workflow_step('lead', v_contract.lead_id, 'contract_signed');
  END IF;
  
  -- Trigger workflow automation if contract has an event
  IF v_contract.event_id IS NOT NULL THEN
    PERFORM public.auto_complete_workflow_step('job', v_contract.event_id, 'contract_signed');
  END IF;
  
  RETURN jsonb_build_object(
    'success', true,
    'contract_id', v_contract.id,
    'signed_at', NOW()
  );
END;
$$;