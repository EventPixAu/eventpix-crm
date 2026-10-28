DROP TRIGGER sync_product_photographer_rate ON public.products;
DROP TRIGGER enforce_linked_unit_rate ON public.pay_rate_card;
COMMENT ON COLUMN public.products.photographer_unit_rate IS 'DEPRECATED: team rates are managed only in pay_rate_card, not Products.';
COMMENT ON COLUMN public.pay_rate_card.unit_rate_product_id IS 'DEPRECATED: client Products and team pay rates are independent.';
CREATE OR REPLACE FUNCTION public.allocate_lighting_pay(_quote_item_id uuid,_assignment_id uuid DEFAULT NULL) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE a public.event_assignments; item_event uuid; item_lead uuid; item_product uuid; pay_rate numeric;
BEGIN
 IF NOT public.has_role(auth.uid(),'admin') AND NOT public.can_access_operations(auth.uid()) THEN RAISE EXCEPTION 'Only event managers can allocate lighting pay'; END IF;
 PERFORM pg_advisory_xact_lock(hashtext(_quote_item_id::text));
 IF _assignment_id IS NULL THEN DELETE FROM public.quote_lighting_pay WHERE quote_item_id=_quote_item_id; RETURN; END IF;
 SELECT q.event_id,q.lead_id,i.product_id INTO item_event,item_lead,item_product FROM public.quote_items i JOIN public.quotes q ON q.id=i.quote_id WHERE i.id=_quote_item_id AND i.quantity>0;
 IF item_product IS DISTINCT FROM 'd085ab8f-4793-41be-a38b-012a3a44baed'::uuid THEN RAISE EXCEPTION 'This budget item is not Studio Lighting kit'; END IF;
 SELECT * INTO a FROM public.event_assignments WHERE id=_assignment_id;
 IF a.id IS NULL OR NOT EXISTS(SELECT 1 FROM public.events e WHERE e.id=a.event_id AND (e.id=item_event OR (item_lead IS NOT NULL AND e.lead_id=item_lead) OR e.quote_id=(SELECT quote_id FROM public.quote_items WHERE id=_quote_item_id))) THEN RAISE EXCEPTION 'Photographer must belong to this budget event'; END IF;
 IF NOT EXISTS(SELECT 1 FROM public.staff_roles r WHERE r.id=a.staff_role_id AND r.is_onsite AND r.name ILIKE '%photograph%') OR EXISTS(SELECT 1 FROM public.profiles p WHERE p.id=a.user_id AND p.is_salaried) THEN RAISE EXCEPTION 'Select a non-salaried onsite photographer'; END IF;
 SELECT COALESCE(a.hourly_rate_override,(a.pay_rate_snapshot->>'hourly_rate')::numeric,r.hourly_rate) INTO pay_rate FROM public.pay_rate_card r WHERE r.staff_role_id=a.staff_role_id;
 IF pay_rate IS NULL OR pay_rate<=0 THEN RAISE EXCEPTION 'Photographer hourly pay rate is required'; END IF;
 INSERT INTO public.quote_lighting_pay(quote_item_id,assignment_id,unit_rate) VALUES(_quote_item_id,_assignment_id,pay_rate) ON CONFLICT(quote_item_id) DO UPDATE SET assignment_id=EXCLUDED.assignment_id;
END $$;