-- ============================================================
-- UNIFIED PLATFORM MVP FINALIZATION
-- ============================================================
-- This migration:
-- 1. Hardens public acceptance security with rate limiting
-- 2. Adds regenerate token function
-- 3. Updates table comments to reflect unified platform
-- ============================================================

-- 1. Create quote acceptance attempt logging table for rate limiting
CREATE TABLE IF NOT EXISTS public.quote_acceptance_attempts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  public_token text NOT NULL,
  attempt_at timestamptz NOT NULL DEFAULT now(),
  success boolean NOT NULL DEFAULT false
);

-- Index for fast lookups by token
CREATE INDEX idx_quote_acceptance_token ON public.quote_acceptance_attempts (public_token, attempt_at);

-- RLS: No direct user access - only via functions
ALTER TABLE public.quote_acceptance_attempts ENABLE ROW LEVEL SECURITY;

-- 2. Update accept_quote_public function with hardened security
CREATE OR REPLACE FUNCTION public.accept_quote_public(
  p_token text,
  p_name text,
  p_email text
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
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
    
    RETURN json_build_object('success', false, 'error', 'Quote not found');
  END IF;
  
  -- Idempotent check: Already accepted
  IF v_quote_status = 'accepted' THEN
    RETURN json_build_object('success', false, 'error', 'This quote has already been accepted');
  END IF;
  
  -- Check if quote is in valid state
  IF v_quote_status NOT IN ('draft', 'sent') THEN
    INSERT INTO public.quote_acceptance_attempts (public_token, success)
    VALUES (p_token, false);
    
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
  
  -- Return success WITHOUT exposing quote_id
  RETURN json_build_object('success', true);
END;
$$;

-- Grant execute to anon for public acceptance
GRANT EXECUTE ON FUNCTION public.accept_quote_public(text, text, text) TO anon;

-- 3. Create function to regenerate public token (Admin/Sales only)
CREATE OR REPLACE FUNCTION public.regenerate_quote_token(p_quote_id uuid)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_old_token text;
  v_new_token text;
BEGIN
  -- Check caller has sales access
  IF NOT public.can_access_sales(auth.uid()) THEN
    RETURN json_build_object('success', false, 'error', 'Access denied');
  END IF;
  
  -- Get old token
  SELECT public_token INTO v_old_token
  FROM public.quotes
  WHERE id = p_quote_id;
  
  IF v_old_token IS NULL THEN
    RETURN json_build_object('success', false, 'error', 'Quote not found');
  END IF;
  
  -- Generate new token
  v_new_token := encode(gen_random_bytes(32), 'hex');
  
  -- Update quote with new token
  UPDATE public.quotes
  SET public_token = v_new_token,
      updated_at = now()
  WHERE id = p_quote_id;
  
  -- Log to audit
  INSERT INTO public.audit_log (action, actor_user_id, event_id, before, after)
  VALUES (
    'event_updated',
    auth.uid(),
    NULL,
    json_build_object('public_token', v_old_token),
    json_build_object('public_token', 'REGENERATED')
  );
  
  RETURN json_build_object('success', true, 'new_token', v_new_token);
END;
$$;

-- 4. Create function for "Send Quote" action (logs manual send)
CREATE OR REPLACE FUNCTION public.mark_quote_as_sent(p_quote_id uuid)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_quote_status text;
  v_public_token text;
  v_client_id uuid;
BEGIN
  -- Check caller has sales access
  IF NOT public.can_access_sales(auth.uid()) THEN
    RETURN json_build_object('success', false, 'error', 'Access denied');
  END IF;
  
  -- Get quote details
  SELECT status, public_token, client_id INTO v_quote_status, v_public_token, v_client_id
  FROM public.quotes
  WHERE id = p_quote_id;
  
  IF v_quote_status IS NULL THEN
    RETURN json_build_object('success', false, 'error', 'Quote not found');
  END IF;
  
  IF v_quote_status = 'accepted' THEN
    RETURN json_build_object('success', false, 'error', 'Quote already accepted');
  END IF;
  
  -- Ensure public token exists
  IF v_public_token IS NULL THEN
    v_public_token := encode(gen_random_bytes(32), 'hex');
    
    UPDATE public.quotes
    SET public_token = v_public_token
    WHERE id = p_quote_id;
  END IF;
  
  -- Update status to sent
  UPDATE public.quotes
  SET status = 'sent',
      updated_at = now()
  WHERE id = p_quote_id;
  
  -- Log to client_communications
  INSERT INTO public.client_communications (
    client_id,
    communication_type,
    subject,
    summary,
    related_quote_id,
    status,
    logged_by
  )
  SELECT
    COALESCE(v_client_id, (SELECT client_id FROM public.leads WHERE id = q.lead_id)),
    'email',
    'Quote sent',
    'Quote link shared manually',
    p_quote_id,
    'sent_manual',
    auth.uid()
  FROM public.quotes q
  WHERE q.id = p_quote_id
    AND COALESCE(v_client_id, (SELECT client_id FROM public.leads WHERE id = q.lead_id)) IS NOT NULL;
  
  RETURN json_build_object('success', true, 'public_token', v_public_token);
END;
$$;

-- 5. Update table comments for unified platform
COMMENT ON TABLE public.job_intake IS 'DEPRECATED: Legacy intake queue from external CRM migration. Use leads table for new sales workflows. Kept for backward compatibility.';
COMMENT ON TABLE public.clients IS 'SALES: Business entities in the unified Eventpix platform. Central to Sales and Ops workflows.';
COMMENT ON TABLE public.leads IS 'SALES: Pipeline opportunities. Unified platform replaces Studio Ninja for CRM.';
COMMENT ON TABLE public.quotes IS 'SALES: Pricing proposals linked to leads. Acceptance triggers event creation.';
COMMENT ON TABLE public.events IS 'OPERATIONS: Core event entity. Linked to clients, leads, and quotes for full lifecycle tracking.';
COMMENT ON COLUMN public.events.invoice_status IS 'ACCOUNTING BOUNDARY: Read-only visibility marker. Actual invoicing handled in Xero.';
COMMENT ON COLUMN public.events.invoice_reference IS 'ACCOUNTING BOUNDARY: Read-only reference to external invoice. No accounting logic in Eventpix.';
COMMENT ON TABLE public.staff_rates IS 'OPERATIONS INTERNAL: Admin-only rate management. Photographers cannot view rate information.';
COMMENT ON TABLE public.staff_event_feedback IS 'OPERATIONS INTERNAL: Admin-managed feedback. Photographers can only view their own feedback.';
COMMENT ON TABLE public.quote_acceptance_attempts IS 'SECURITY: Rate limiting table for public quote acceptance. No direct user access.';

-- 6. Add event_id column to quotes for "Converted" indicator
ALTER TABLE public.quotes 
ADD COLUMN IF NOT EXISTS linked_event_id uuid REFERENCES public.events(id);