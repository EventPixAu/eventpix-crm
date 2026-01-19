-- Add event_id column to contracts for jobs
ALTER TABLE public.contracts 
ADD COLUMN IF NOT EXISTS event_id uuid REFERENCES public.events(id) ON DELETE SET NULL;

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_contracts_event_id ON public.contracts(event_id);

-- Update trigger to also check direct event_id
CREATE OR REPLACE FUNCTION public.trigger_workflow_on_contract_signed()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  -- When contract is signed, trigger workflow auto-steps
  IF NEW.status = 'signed' AND (OLD.status IS NULL OR OLD.status != 'signed') THEN
    -- Check if contract belongs to a lead
    IF NEW.lead_id IS NOT NULL THEN
      PERFORM public.auto_complete_workflow_step('lead', NEW.lead_id, 'contract_signed');
    END IF;
    
    -- Check if contract has a direct event_id (Job)
    IF NEW.event_id IS NOT NULL THEN
      PERFORM public.auto_complete_workflow_step('job', NEW.event_id, 'contract_signed');
    END IF;
    
    -- Also check if contract has a quote that belongs to an event
    IF NEW.quote_id IS NOT NULL THEN
      DECLARE
        v_event_id UUID;
      BEGIN
        SELECT event_id INTO v_event_id FROM public.quotes WHERE id = NEW.quote_id;
        IF v_event_id IS NOT NULL AND (NEW.event_id IS NULL OR NEW.event_id != v_event_id) THEN
          PERFORM public.auto_complete_workflow_step('job', v_event_id, 'contract_signed');
        END IF;
      END;
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$;

-- Create RPC to simulate signing a contract (internal admin/ops use)
CREATE OR REPLACE FUNCTION public.sign_contract_internal(
  p_contract_id uuid,
  p_signed_by_name text DEFAULT NULL,
  p_signed_by_email text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_contract RECORD;
  v_user_id uuid := auth.uid();
BEGIN
  -- Check caller has sales access
  IF NOT public.can_access_sales(v_user_id) THEN
    RETURN jsonb_build_object('success', false, 'error', 'Access denied');
  END IF;
  
  -- Get contract
  SELECT id, status, lead_id, event_id INTO v_contract
  FROM public.contracts
  WHERE id = p_contract_id;
  
  IF v_contract.id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Contract not found');
  END IF;
  
  IF v_contract.status = 'signed' THEN
    RETURN jsonb_build_object('success', false, 'error', 'Contract already signed');
  END IF;
  
  -- Update contract to signed
  UPDATE public.contracts
  SET 
    status = 'signed',
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
$$;

REVOKE ALL ON FUNCTION public.sign_contract_internal(uuid, text, text) FROM public;
GRANT EXECUTE ON FUNCTION public.sign_contract_internal(uuid, text, text) TO authenticated;