-- Add signature data columns to contracts table
ALTER TABLE public.contracts
ADD COLUMN IF NOT EXISTS signature_data TEXT NULL,
ADD COLUMN IF NOT EXISTS signature_ip TEXT NULL,
ADD COLUMN IF NOT EXISTS signature_user_agent TEXT NULL;

COMMENT ON COLUMN public.contracts.signature_data IS 'Base64 encoded PNG of the client''s digital signature';
COMMENT ON COLUMN public.contracts.signature_ip IS 'IP address captured at time of signing';
COMMENT ON COLUMN public.contracts.signature_user_agent IS 'User agent captured at time of signing';

-- Create or replace the accept_contract_public function to handle signature data
CREATE OR REPLACE FUNCTION public.accept_contract_public(
  p_token TEXT,
  p_name TEXT,
  p_email TEXT,
  p_signature_data TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public', 'pg_temp'
AS $$
DECLARE
  v_contract RECORD;
  v_attempts INTEGER;
BEGIN
  -- Get contract by public token
  SELECT id, status, lead_id, event_id, quote_id INTO v_contract
  FROM public.contracts
  WHERE public_token = p_token;
  
  IF v_contract.id IS NULL THEN
    -- Log failed attempt
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
  
  -- Check for too many attempts (rate limiting)
  SELECT COUNT(*) INTO v_attempts
  FROM public.contract_acceptance_attempts
  WHERE public_token = p_token
    AND attempt_at > NOW() - INTERVAL '1 hour';
    
  IF v_attempts > 10 THEN
    RETURN jsonb_build_object('success', false, 'error', 'Too many attempts. Please try again later.');
  END IF;
  
  -- Update contract to signed status
  UPDATE public.contracts
  SET 
    status = 'signed',
    signed_at = NOW(),
    signed_by_name = p_name,
    signed_by_email = p_email,
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
  
  -- Trigger workflow automation if contract has an event (Job)
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