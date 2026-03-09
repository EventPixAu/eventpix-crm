-- Fix the mark_contract_as_sent RPC to reliably update both status columns in a single UPDATE
CREATE OR REPLACE FUNCTION public.mark_contract_as_sent(p_contract_id uuid)
 RETURNS json
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_contract RECORD;
  v_public_token text;
BEGIN
  IF NOT public.can_access_sales(auth.uid()) THEN
    RETURN json_build_object('success', false, 'error', 'Access denied');
  END IF;
  
  SELECT status, public_token INTO v_contract
  FROM public.contracts
  WHERE id = p_contract_id;
  
  IF v_contract IS NULL THEN
    RETURN json_build_object('success', false, 'error', 'Contract not found');
  END IF;
  
  IF v_contract.status = 'signed' THEN
    RETURN json_build_object('success', false, 'error', 'Contract already signed');
  END IF;
  
  v_public_token := v_contract.public_token;
  IF v_public_token IS NULL THEN
    v_public_token := encode(gen_random_bytes(32), 'hex');
  END IF;
  
  UPDATE public.contracts
  SET status = 'sent',
      contract_status = 'sent',
      public_token = v_public_token,
      sent_at = now(),
      updated_at = now()
  WHERE id = p_contract_id;
  
  RETURN json_build_object('success', true, 'public_token', v_public_token);
END;
$function$;

-- Also fix sign_contract_internal to update contract_status column
CREATE OR REPLACE FUNCTION public.sign_contract_internal(p_contract_id uuid, p_signed_by_name text DEFAULT NULL::text, p_signed_by_email text DEFAULT NULL::text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  v_contract RECORD;
  v_user_id uuid := auth.uid();
BEGIN
  IF NOT public.can_access_sales(v_user_id) THEN
    RETURN jsonb_build_object('success', false, 'error', 'Access denied');
  END IF;
  
  SELECT id, status, lead_id, event_id INTO v_contract
  FROM public.contracts
  WHERE id = p_contract_id;
  
  IF v_contract.id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Contract not found');
  END IF;
  
  IF v_contract.status = 'signed' THEN
    RETURN jsonb_build_object('success', false, 'error', 'Contract already signed');
  END IF;
  
  UPDATE public.contracts
  SET 
    status = 'signed',
    contract_status = 'signed',
    signed_at = now(),
    signed_by_name = COALESCE(p_signed_by_name, 'Signed internally'),
    signed_by_email = p_signed_by_email,
    updated_at = now()
  WHERE id = p_contract_id;
  
  RETURN jsonb_build_object(
    'success', true,
    'contract_id', p_contract_id,
    'signed_at', now()
  );
END;
$function$;

-- Fix existing contracts that have tokens but are still draft - they were already sent
UPDATE public.contracts
SET status = 'sent', contract_status = 'sent', sent_at = now(), updated_at = now()
WHERE public_token IS NOT NULL AND status = 'draft' AND signed_at IS NULL;