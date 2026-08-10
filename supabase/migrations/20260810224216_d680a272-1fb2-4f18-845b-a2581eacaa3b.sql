CREATE OR REPLACE FUNCTION public.create_quote_revision(p_quote_id uuid)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_src public.quotes%ROWTYPE;
  v_new_id uuid;
  v_root uuid;
  v_next int;
BEGIN
  SELECT * INTO v_src FROM public.quotes WHERE id = p_quote_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Budget not found';
  END IF;

  v_root := COALESCE(v_src.parent_quote_id, v_src.id);

  SELECT COALESCE(MAX(COALESCE(quote_version, 1)), 1) + 1 INTO v_next
  FROM public.quotes
  WHERE id = v_root OR parent_quote_id = v_root;

  INSERT INTO public.quotes (
    lead_id, client_id, event_id, event_series_id, linked_event_id, scope,
    quote_name, notes, notes_internal, intro_text, scope_text, terms_text,
    proposed_services, po_number, valid_until, issue_date,
    discount_percent, discount_amount, discount_label, discount_groups,
    selection_mode, subtotal, tax_total, total_estimate,
    status, quote_status, is_locked, quote_version, parent_quote_id, created_by
  )
  VALUES (
    v_src.lead_id, v_src.client_id, v_src.event_id, v_src.event_series_id, v_src.linked_event_id, v_src.scope,
    COALESCE(v_src.quote_name, 'Budget') || ' (v' || v_next || ')',
    v_src.notes, v_src.notes_internal, v_src.intro_text, v_src.scope_text, v_src.terms_text,
    v_src.proposed_services, v_src.po_number, v_src.valid_until, CURRENT_DATE,
    v_src.discount_percent, v_src.discount_amount, v_src.discount_label, v_src.discount_groups,
    v_src.selection_mode, v_src.subtotal, v_src.tax_total, v_src.total_estimate,
    'draft'::quote_status, 'draft', false, v_next, v_root, auth.uid()
  )
  RETURNING id INTO v_new_id;

  INSERT INTO public.quote_items (
    quote_id, product_id, description, quantity, unit_price, tax_rate, sort_order,
    group_label, discount_percent, discount_amount, is_package_item, package_source_id,
    pricing_basis, event_count
  )
  SELECT v_new_id, product_id, description, quantity, unit_price, tax_rate, sort_order,
         group_label, discount_percent, discount_amount, is_package_item, package_source_id,
         pricing_basis, event_count
  FROM public.quote_items
  WHERE quote_id = p_quote_id
  ORDER BY sort_order NULLS LAST, created_at;

  RETURN v_new_id;
END;
$$;

REVOKE ALL ON FUNCTION public.create_quote_revision(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.create_quote_revision(uuid) TO authenticated;