
-- Fix accept_quote function to avoid trigger conflicts
-- The function was duplicating work that triggers already handle, causing the "tuple already modified" error

CREATE OR REPLACE FUNCTION public.accept_quote(
  p_quote_id uuid, 
  p_accepted_by_name text DEFAULT NULL::text, 
  p_accepted_by_email text DEFAULT NULL::text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_quote RECORD;
  v_event_id UUID;
BEGIN
  -- Get quote details
  SELECT * INTO v_quote FROM quotes WHERE id = p_quote_id;
  
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Quote not found');
  END IF;
  
  -- Check if already locked/accepted
  IF v_quote.is_locked OR v_quote.status = 'accepted' THEN
    RETURN jsonb_build_object('success', false, 'error', 'Quote is already accepted or locked');
  END IF;
  
  -- Get linked event (job) ID before the update
  v_event_id := COALESCE(v_quote.event_id, v_quote.linked_event_id);
  
  -- Only set status to accepted - the BEFORE trigger (lock_quote_on_acceptance) 
  -- will handle setting is_locked and locking items.
  -- The AFTER trigger (trigger_workflow_on_quote_accepted) will handle workflow auto-steps.
  UPDATE quotes
  SET 
    status = 'accepted',
    quote_status = 'accepted',
    accepted_at = now(),
    accepted_by_name = COALESCE(p_accepted_by_name, accepted_by_name),
    accepted_by_email = COALESCE(p_accepted_by_email, accepted_by_email)
    -- Note: is_locked is set by the lock_quote_on_acceptance trigger
    -- Note: updated_at is set by the update_quotes_updated_at trigger
  WHERE id = p_quote_id;
  
  -- If we have an event, update its ops_status
  IF v_event_id IS NOT NULL THEN
    UPDATE events
    SET ops_status = COALESCE(ops_status, 'booked')
    -- Note: updated_at is set by the update_events_updated_at trigger
    WHERE id = v_event_id;
  END IF;
  
  RETURN jsonb_build_object(
    'success', true,
    'quote_id', p_quote_id,
    'event_id', v_event_id,
    'accepted_at', now()
  );
END;
$function$;
