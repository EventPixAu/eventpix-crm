-- Add public token and signed by fields to contracts
ALTER TABLE public.contracts
ADD COLUMN IF NOT EXISTS public_token text UNIQUE,
ADD COLUMN IF NOT EXISTS signed_by_name text,
ADD COLUMN IF NOT EXISTS signed_by_email text;

-- Create contract acceptance attempts table for rate limiting
CREATE TABLE public.contract_acceptance_attempts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  public_token text NOT NULL,
  attempt_at timestamptz NOT NULL DEFAULT now(),
  success boolean NOT NULL DEFAULT false
);

-- Enable RLS on attempts table
ALTER TABLE public.contract_acceptance_attempts ENABLE ROW LEVEL SECURITY;

-- Allow inserts from anyone (for logging attempts)
CREATE POLICY "Anyone can log contract acceptance attempts"
ON public.contract_acceptance_attempts
FOR INSERT
WITH CHECK (true);

-- Trigger to generate public token on contract creation
CREATE OR REPLACE FUNCTION public.generate_contract_public_token()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.public_token IS NULL THEN
    NEW.public_token := encode(extensions.gen_random_bytes(32), 'hex');
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

CREATE TRIGGER generate_contract_token_trigger
BEFORE INSERT ON public.contracts
FOR EACH ROW
EXECUTE FUNCTION public.generate_contract_public_token();

-- Trigger to prevent modifications after signing
CREATE OR REPLACE FUNCTION public.lock_signed_contract()
RETURNS TRIGGER AS $$
BEGIN
  IF OLD.status = 'signed' THEN
    RAISE EXCEPTION 'Cannot modify a signed contract';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

CREATE TRIGGER lock_signed_contract_trigger
BEFORE UPDATE ON public.contracts
FOR EACH ROW
EXECUTE FUNCTION public.lock_signed_contract();

-- Function to accept contract publicly
CREATE OR REPLACE FUNCTION public.accept_contract_public(p_token text, p_name text, p_email text)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
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
    RETURN json_build_object('success', false, 'error', 'Too many attempts. Please try again later.');
  END IF;
  
  -- Get contract by token
  SELECT id, status INTO v_contract_id, v_contract_status
  FROM public.contracts
  WHERE public_token = p_token;
  
  IF v_contract_id IS NULL THEN
    INSERT INTO public.contract_acceptance_attempts (public_token, success)
    VALUES (p_token, false);
    RETURN json_build_object('success', false, 'error', 'Contract not found');
  END IF;
  
  -- Idempotent check: Already signed
  IF v_contract_status = 'signed' THEN
    RETURN json_build_object('success', false, 'error', 'This contract has already been signed');
  END IF;
  
  -- Check if contract is in valid state
  IF v_contract_status NOT IN ('draft', 'sent') THEN
    INSERT INTO public.contract_acceptance_attempts (public_token, success)
    VALUES (p_token, false);
    RETURN json_build_object('success', false, 'error', 'Contract is not available for signing');
  END IF;
  
  -- Sign the contract (temporarily disable trigger for this update)
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
  
  RETURN json_build_object('success', true);
END;
$$;

-- Grant execute permission to anon for public acceptance
GRANT EXECUTE ON FUNCTION public.accept_contract_public(text, text, text) TO anon;

-- Function to regenerate contract token
CREATE OR REPLACE FUNCTION public.regenerate_contract_token(p_contract_id uuid)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_old_token text;
  v_new_token text;
  v_status text;
BEGIN
  -- Check caller has sales access
  IF NOT public.can_access_sales(auth.uid()) THEN
    RETURN json_build_object('success', false, 'error', 'Access denied');
  END IF;
  
  -- Get old token and status
  SELECT public_token, status INTO v_old_token, v_status
  FROM public.contracts
  WHERE id = p_contract_id;
  
  IF v_old_token IS NULL THEN
    RETURN json_build_object('success', false, 'error', 'Contract not found');
  END IF;
  
  IF v_status = 'signed' THEN
    RETURN json_build_object('success', false, 'error', 'Cannot regenerate token for signed contract');
  END IF;
  
  -- Generate new token
  v_new_token := encode(gen_random_bytes(32), 'hex');
  
  -- Update contract with new token
  UPDATE public.contracts
  SET public_token = v_new_token,
      updated_at = now()
  WHERE id = p_contract_id;
  
  RETURN json_build_object('success', true, 'new_token', v_new_token);
END;
$$;

-- Function to mark contract as sent
CREATE OR REPLACE FUNCTION public.mark_contract_as_sent(p_contract_id uuid)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_contract_status text;
  v_public_token text;
BEGIN
  -- Check caller has sales access
  IF NOT public.can_access_sales(auth.uid()) THEN
    RETURN json_build_object('success', false, 'error', 'Access denied');
  END IF;
  
  -- Get contract details
  SELECT status, public_token INTO v_contract_status, v_public_token
  FROM public.contracts
  WHERE id = p_contract_id;
  
  IF v_contract_status IS NULL THEN
    RETURN json_build_object('success', false, 'error', 'Contract not found');
  END IF;
  
  IF v_contract_status = 'signed' THEN
    RETURN json_build_object('success', false, 'error', 'Contract already signed');
  END IF;
  
  -- Ensure public token exists
  IF v_public_token IS NULL THEN
    v_public_token := encode(gen_random_bytes(32), 'hex');
    
    UPDATE public.contracts
    SET public_token = v_public_token
    WHERE id = p_contract_id;
  END IF;
  
  -- Update status to sent
  UPDATE public.contracts
  SET status = 'sent',
      sent_at = now(),
      updated_at = now()
  WHERE id = p_contract_id;
  
  RETURN json_build_object('success', true, 'public_token', v_public_token);
END;
$$;