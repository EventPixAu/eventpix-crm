CREATE OR REPLACE FUNCTION public.convert_quote_to_event(p_input jsonb)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_quote public.quotes%ROWTYPE;
  v_lead public.leads%ROWTYPE;
  v_event_id uuid;
  v_quote_id uuid := (p_input->>'quote_id')::uuid;
  v_event_data jsonb := COALESCE(p_input->'event_data', '{}'::jsonb);
BEGIN
  IF v_quote_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'step', 'validate_input', 'error', 'quote_id is required');
  END IF;

  SELECT *
  INTO v_quote
  FROM public.quotes
  WHERE id = v_quote_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'step', 'fetch_quote', 'error', 'Quote not found');
  END IF;

  IF v_quote.event_id IS NOT NULL OR v_quote.linked_event_id IS NOT NULL THEN
    RETURN jsonb_build_object('success', true, 'event_id', COALESCE(v_quote.event_id, v_quote.linked_event_id), 'already_converted', true);
  END IF;

  IF v_quote.lead_id IS NOT NULL THEN
    SELECT *
    INTO v_lead
    FROM public.leads
    WHERE id = v_quote.lead_id
    FOR UPDATE;
  END IF;

  INSERT INTO public.events (
    event_name,
    event_date,
    start_time,
    end_time,
    venue_name,
    venue_address,
    notes,
    client_id,
    client_name,
    lead_id,
    quote_id,
    event_type,
    event_type_id,
    created_by,
    updated_at
  )
  VALUES (
    COALESCE(NULLIF(v_event_data->>'event_name', ''), v_lead.lead_name, v_quote.quote_name, v_quote.quote_number, 'Converted Event'),
    COALESCE(NULLIF(v_event_data->>'event_date', '')::date, v_lead.estimated_event_date, CURRENT_DATE),
    NULLIF(v_event_data->>'start_time', '')::time,
    NULLIF(v_event_data->>'end_time', '')::time,
    NULLIF(v_event_data->>'venue_name', ''),
    COALESCE(NULLIF(v_event_data->>'venue_address', ''), v_lead.venue_text),
    NULLIF(v_event_data->>'notes', ''),
    COALESCE(v_quote.client_id, v_lead.client_id),
    COALESCE((SELECT c.business_name FROM public.clients c WHERE c.id = COALESCE(v_quote.client_id, v_lead.client_id)), 'Client'),
    v_quote.lead_id,
    v_quote.id,
    'other'::public.event_type,
    v_lead.event_type_id,
    auth.uid(),
    now()
  )
  RETURNING id INTO v_event_id;

  UPDATE public.quotes
  SET status = 'accepted'::public.quote_status,
      quote_status = 'accepted',
      accepted_at = COALESCE(accepted_at, now()),
      event_id = v_event_id,
      linked_event_id = v_event_id,
      is_locked = true,
      updated_at = now()
  WHERE id = v_quote.id;

  IF v_quote.lead_id IS NOT NULL THEN
    UPDATE public.leads
    SET status = 'Won',
        converted_job_id = v_event_id,
        updated_at = now()
    WHERE id = v_quote.lead_id;
  END IF;

  RETURN jsonb_build_object('success', true, 'event_id', v_event_id);
EXCEPTION WHEN OTHERS THEN
  RETURN jsonb_build_object('success', false, 'step', 'convert_quote_to_event', 'error', SQLERRM, 'sqlstate', SQLSTATE);
END;
$$;

GRANT EXECUTE ON FUNCTION public.convert_quote_to_event(jsonb) TO authenticated;
