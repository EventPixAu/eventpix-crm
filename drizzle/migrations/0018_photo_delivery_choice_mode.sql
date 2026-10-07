ALTER TABLE public.quotes DROP CONSTRAINT IF EXISTS quotes_selection_mode_check;
ALTER TABLE public.quotes ADD CONSTRAINT quotes_selection_mode_check CHECK (selection_mode = ANY (ARRAY['standard','single_choice','photo_delivery_choice']));

DROP FUNCTION IF EXISTS public.accept_quote_public(text,text,text,uuid);
DROP FUNCTION IF EXISTS public.accept_quote(uuid,text,text,uuid);

CREATE FUNCTION public.accept_quote(p_quote_id uuid, p_accepted_by_name text DEFAULT NULL, p_accepted_by_email text DEFAULT NULL, p_selected_item_id uuid DEFAULT NULL, p_include_delivery boolean DEFAULT NULL)
 RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE
  v_quote RECORD; v_event_id UUID; v_item RECORD;
BEGIN
  SELECT * INTO v_quote FROM quotes WHERE id = p_quote_id;
  IF NOT FOUND THEN RETURN jsonb_build_object('success', false, 'error', 'Quote not found'); END IF;
  IF v_quote.is_locked OR v_quote.status = 'accepted' THEN
    RETURN jsonb_build_object('success', false, 'error', 'Quote is already accepted or locked');
  END IF;

  IF v_quote.selection_mode = 'single_choice' THEN
    IF p_selected_item_id IS NULL THEN RETURN jsonb_build_object('success', false, 'error', 'Please select an option'); END IF;
    SELECT * INTO v_item FROM quote_items WHERE id = p_selected_item_id AND quote_id = p_quote_id;
    IF NOT FOUND THEN RETURN jsonb_build_object('success', false, 'error', 'Selected option not found'); END IF;
    DELETE FROM quote_items WHERE quote_id = p_quote_id AND id <> p_selected_item_id;
    UPDATE quotes SET accepted_item_id = p_selected_item_id WHERE id = p_quote_id;
  ELSIF v_quote.selection_mode = 'photo_delivery_choice' THEN
    IF p_include_delivery IS NULL THEN RETURN jsonb_build_object('success', false, 'error', 'Please choose Photography only or Photography + Delivery'); END IF;
    IF NOT p_include_delivery THEN
      DELETE FROM quote_items WHERE quote_id = p_quote_id AND lower(trim(coalesce(group_label,''))) = 'delivery';
    END IF;
  END IF;

  v_event_id := COALESCE(v_quote.event_id, v_quote.linked_event_id);
  UPDATE quotes SET status = 'accepted', quote_status = 'accepted', accepted_at = now(),
    accepted_by_name = COALESCE(p_accepted_by_name, accepted_by_name),
    accepted_by_email = COALESCE(p_accepted_by_email, accepted_by_email)
  WHERE id = p_quote_id;
  IF v_event_id IS NOT NULL THEN
    UPDATE events SET ops_status = COALESCE(ops_status, 'booked') WHERE id = v_event_id;
  END IF;
  RETURN jsonb_build_object('success', true, 'quote_id', p_quote_id, 'event_id', v_event_id, 'accepted_at', now());
END;
$function$;

CREATE FUNCTION public.accept_quote_public(p_token text, p_name text, p_email text, p_selected_item_id uuid DEFAULT NULL, p_include_delivery boolean DEFAULT NULL)
 RETURNS json LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE
  v_quote RECORD; v_result jsonb; v_attempts INTEGER; v_clean_name text; v_clean_email text;
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
  SELECT id, status INTO v_quote FROM public.quotes WHERE public_token = p_token;
  IF v_quote.id IS NULL THEN RETURN json_build_object('success', false, 'error', 'Quote not found or link expired'); END IF;
  IF v_quote.status = 'accepted' THEN RETURN json_build_object('success', false, 'error', 'Quote already accepted'); END IF;
  SELECT COUNT(*) INTO v_attempts FROM public.contract_acceptance_attempts
  WHERE public_token = p_token AND attempt_at > NOW() - INTERVAL '1 hour';
  IF v_attempts > 10 THEN RETURN json_build_object('success', false, 'error', 'Too many attempts. Please try again later.'); END IF;
  v_result := public.accept_quote(v_quote.id, v_clean_name, v_clean_email, p_selected_item_id, p_include_delivery);
  IF NOT COALESCE((v_result->>'success')::boolean, false) THEN
    RETURN json_build_object('success', false, 'error', COALESCE(v_result->>'error', 'Failed to accept quote'));
  END IF;
  RETURN json_build_object('success', true, 'quote_id', v_quote.id, 'accepted_at', now());
END;
$function$;

GRANT EXECUTE ON FUNCTION public.accept_quote(uuid,text,text,uuid,boolean) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.accept_quote_public(text,text,text,uuid,boolean) TO anon, authenticated, service_role;