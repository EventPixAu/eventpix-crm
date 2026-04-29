CREATE OR REPLACE FUNCTION public.convert_quote_to_event(p_input jsonb)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_quote_id uuid;
  v_quote record;
  v_event_id uuid;
  v_event_data jsonb;
BEGIN
  v_quote_id := (p_input->>'quote_id')::uuid;
  v_event_data := p_input->'event_data';

  SELECT q.*, q.lead_id, q.client_id
  INTO v_quote
  FROM public.quotes q
  WHERE q.id = v_quote_id
  FOR UPDATE;

  IF v_quote IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Quote not found');
  END IF;

  IF v_quote.linked_event_id IS NOT NULL OR v_quote.event_id IS NOT NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Quote has already been converted to an event');
  END IF;

  INSERT INTO public.events (
    event_name,
    event_date,
    event_type_id,
    start_time,
    end_time,
    venue_name,
    venue_address,
    notes,
    client_id,
    lead_id,
    quote_id,
    event_type,
    ops_status
  ) VALUES (
    v_event_data->>'event_name',
    (v_event_data->>'event_date')::date,
    (v_event_data->>'event_type_id')::uuid,
    (v_event_data->>'start_time')::time,
    (v_event_data->>'end_time')::time,
    v_event_data->>'venue_name',
    v_event_data->>'venue_address',
    v_event_data->>'notes',
    v_quote.client_id,
    v_quote.lead_id,
    v_quote_id,
    'corporate',
    'confirmed'
  )
  RETURNING id INTO v_event_id;

  UPDATE public.quotes
  SET
    status = 'accepted',
    quote_status = 'accepted',
    linked_event_id = v_event_id,
    event_id = v_event_id,
    updated_at = now()
  WHERE id = v_quote_id;

  IF v_quote.lead_id IS NOT NULL THEN
    UPDATE public.leads
    SET
      status = 'Won',
      converted_job_id = v_event_id,
      updated_at = now()
    WHERE id = v_quote.lead_id;
  END IF;

  IF v_quote.client_id IS NOT NULL THEN
    UPDATE public.clients
    SET manual_status = 'Active Event'
    WHERE id = v_quote.client_id;
  END IF;

  RETURN jsonb_build_object('success', true, 'event_id', v_event_id);
END;
$$;