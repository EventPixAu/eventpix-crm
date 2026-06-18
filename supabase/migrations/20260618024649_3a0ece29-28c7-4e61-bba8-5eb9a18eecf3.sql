
ALTER TABLE public.quotes
  ADD COLUMN IF NOT EXISTS selection_mode text NOT NULL DEFAULT 'standard',
  ADD COLUMN IF NOT EXISTS accepted_item_id uuid REFERENCES public.quote_items(id) ON DELETE SET NULL;

ALTER TABLE public.quotes DROP CONSTRAINT IF EXISTS quotes_selection_mode_check;
ALTER TABLE public.quotes
  ADD CONSTRAINT quotes_selection_mode_check CHECK (selection_mode IN ('standard','single_choice'));

DROP FUNCTION IF EXISTS public.get_quote_by_public_token(text);
DROP FUNCTION IF EXISTS public.get_quote_items_by_public_token(text);
DROP FUNCTION IF EXISTS public.accept_quote_public(text, text, text);
DROP FUNCTION IF EXISTS public.accept_quote(uuid, text, text);

CREATE OR REPLACE FUNCTION public.accept_quote(
  p_quote_id uuid,
  p_accepted_by_name text DEFAULT NULL,
  p_accepted_by_email text DEFAULT NULL,
  p_selected_item_id uuid DEFAULT NULL
)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE
  v_quote RECORD;
  v_event_id UUID;
  v_item RECORD;
BEGIN
  SELECT * INTO v_quote FROM quotes WHERE id = p_quote_id;
  IF NOT FOUND THEN RETURN jsonb_build_object('success', false, 'error', 'Quote not found'); END IF;
  IF v_quote.is_locked OR v_quote.status = 'accepted' THEN
    RETURN jsonb_build_object('success', false, 'error', 'Quote is already accepted or locked');
  END IF;

  IF v_quote.selection_mode = 'single_choice' THEN
    IF p_selected_item_id IS NULL THEN
      RETURN jsonb_build_object('success', false, 'error', 'Please select an option');
    END IF;
    SELECT * INTO v_item FROM quote_items WHERE id = p_selected_item_id AND quote_id = p_quote_id;
    IF NOT FOUND THEN
      RETURN jsonb_build_object('success', false, 'error', 'Selected option not found');
    END IF;
    DELETE FROM quote_items WHERE quote_id = p_quote_id AND id <> p_selected_item_id;
    UPDATE quotes SET accepted_item_id = p_selected_item_id WHERE id = p_quote_id;
  END IF;

  v_event_id := COALESCE(v_quote.event_id, v_quote.linked_event_id);

  UPDATE quotes SET
    status = 'accepted', quote_status = 'accepted', accepted_at = now(),
    accepted_by_name = COALESCE(p_accepted_by_name, accepted_by_name),
    accepted_by_email = COALESCE(p_accepted_by_email, accepted_by_email)
  WHERE id = p_quote_id;

  IF v_event_id IS NOT NULL THEN
    UPDATE events SET ops_status = COALESCE(ops_status, 'booked') WHERE id = v_event_id;
  END IF;

  RETURN jsonb_build_object('success', true, 'quote_id', p_quote_id, 'event_id', v_event_id, 'accepted_at', now());
END;
$function$;

CREATE OR REPLACE FUNCTION public.accept_quote_public(
  p_token text, p_name text, p_email text, p_selected_item_id uuid DEFAULT NULL
)
RETURNS json LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE
  v_quote RECORD;
  v_result jsonb;
  v_attempts INTEGER;
  v_clean_name text;
  v_clean_email text;
BEGIN
  v_clean_name := trim(p_name);
  IF v_clean_name IS NULL OR length(v_clean_name) < 1 OR length(v_clean_name) > 200 THEN
    RETURN json_build_object('success', false, 'error', 'Name must be 1-200 characters');
  END IF;
  v_clean_email := lower(trim(p_email));
  IF length(v_clean_email) > 255 THEN RETURN json_build_object('success', false, 'error', 'Email too long'); END IF;
  IF v_clean_email !~ '^[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}$' THEN
    RETURN json_build_object('success', false, 'error', 'Invalid email format');
  END IF;
  IF p_token IS NULL OR length(p_token) < 10 OR length(p_token) > 256 THEN
    RETURN json_build_object('success', false, 'error', 'Invalid token');
  END IF;

  SELECT id, status, lead_id, event_id INTO v_quote FROM public.quotes WHERE public_token = p_token;
  IF v_quote.id IS NULL THEN RETURN json_build_object('success', false, 'error', 'Quote not found or link expired'); END IF;
  IF v_quote.status = 'accepted' THEN RETURN json_build_object('success', false, 'error', 'Quote already accepted'); END IF;

  SELECT COUNT(*) INTO v_attempts FROM public.contract_acceptance_attempts
  WHERE public_token = p_token AND attempt_at > NOW() - INTERVAL '1 hour';
  IF v_attempts > 10 THEN
    RETURN json_build_object('success', false, 'error', 'Too many attempts. Please try again later.');
  END IF;

  v_result := public.accept_quote(v_quote.id, v_clean_name, v_clean_email, p_selected_item_id);
  IF NOT COALESCE((v_result->>'success')::boolean, false) THEN
    RETURN json_build_object('success', false, 'error', COALESCE(v_result->>'error', 'Failed to accept quote'));
  END IF;
  RETURN json_build_object('success', true, 'quote_id', v_quote.id, 'accepted_at', now());
END;
$function$;

CREATE OR REPLACE FUNCTION public.get_quote_by_public_token(p_token text)
RETURNS TABLE(
  id uuid, quote_number text, status text, subtotal numeric, tax_total numeric,
  total_estimate numeric, valid_until date, terms_text text, accepted_at timestamp with time zone,
  selection_mode text, intro_text text, quote_name text
)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $function$
  SELECT q.id, q.quote_number, q.status::text, q.subtotal, q.tax_total,
         q.total_estimate, q.valid_until, q.terms_text, q.accepted_at,
         COALESCE(q.selection_mode,'standard'), q.intro_text, q.quote_name
  FROM public.quotes q
  WHERE p_token IS NOT NULL AND length(p_token) >= 10
    AND q.public_token = p_token
    AND q.status::text = ANY (ARRAY['sent','viewed','accepted'])
  LIMIT 1;
$function$;

CREATE OR REPLACE FUNCTION public.get_quote_items_by_public_token(p_token text)
RETURNS TABLE(id uuid, description text, quantity numeric, unit_price numeric, line_total numeric, group_label text, sort_order integer)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $function$
  SELECT qi.id, qi.description, qi.quantity, qi.unit_price, qi.line_total, qi.group_label, qi.sort_order
  FROM public.quote_items qi
  JOIN public.quotes q ON q.id = qi.quote_id
  WHERE p_token IS NOT NULL AND length(p_token) >= 10
    AND q.public_token = p_token
    AND q.status::text = ANY (ARRAY['sent','viewed','accepted'])
  ORDER BY qi.sort_order;
$function$;
