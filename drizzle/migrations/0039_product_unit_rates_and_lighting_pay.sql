ALTER TABLE public.products ADD COLUMN photographer_unit_rate numeric CHECK (photographer_unit_rate >= 0);
ALTER TABLE public.pay_rate_card ADD COLUMN unit_rate_product_id uuid REFERENCES public.products(id);
UPDATE public.products SET photographer_unit_rate=125 WHERE id='22222222-0001-0001-0001-000000000004';
UPDATE public.pay_rate_card SET unit_rate_product_id='22222222-0001-0001-0001-000000000004' WHERE staff_role_id IN ('3c86cd59-5ebe-49a0-8d51-0b0ce7d44c78','3da8ec25-8aec-4e66-b5fa-3519ae24782d');
ALTER TABLE public.event_assignments ADD COLUMN pay_rate_snapshot jsonb;
ALTER TABLE public.event_assignments DISABLE TRIGGER USER;
UPDATE public.event_assignments a SET pay_rate_snapshot=to_jsonb(r)-'id'-'created_at'-'updated_at' FROM public.pay_rate_card r WHERE r.staff_role_id=a.staff_role_id;
ALTER TABLE public.event_assignments ENABLE TRIGGER USER;
CREATE FUNCTION public.snapshot_assignment_pay_rate() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$ BEGIN
 IF TG_OP='INSERT' OR NEW.staff_role_id IS DISTINCT FROM OLD.staff_role_id THEN SELECT to_jsonb(r)-'id'-'created_at'-'updated_at' INTO NEW.pay_rate_snapshot FROM public.pay_rate_card r WHERE r.staff_role_id=NEW.staff_role_id;
 ELSIF NEW.pay_rate_snapshot IS DISTINCT FROM OLD.pay_rate_snapshot THEN RAISE EXCEPTION 'Assignment rate snapshots cannot be edited directly'; END IF; RETURN NEW; END $$;
CREATE TRIGGER snapshot_assignment_pay_rate BEFORE INSERT OR UPDATE ON public.event_assignments FOR EACH ROW EXECUTE FUNCTION public.snapshot_assignment_pay_rate();
CREATE FUNCTION public.sync_product_photographer_rate() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$ BEGIN
 IF NEW.photographer_unit_rate IS DISTINCT FROM OLD.photographer_unit_rate THEN
 IF auth.uid() IS NOT NULL AND NOT public.has_role(auth.uid(),'admin') THEN RAISE EXCEPTION 'Only admins can change photographer unit rates'; END IF;
 IF NEW.photographer_unit_rate IS NULL AND EXISTS(SELECT 1 FROM public.pay_rate_card WHERE unit_rate_product_id=NEW.id) THEN RAISE EXCEPTION 'Standard photographer rate is required'; END IF;
 UPDATE public.pay_rate_card SET hourly_rate=NEW.photographer_unit_rate,updated_at=now() WHERE unit_rate_product_id=NEW.id AND rate_mode='hourly'; END IF; RETURN NEW; END $$;
CREATE TRIGGER sync_product_photographer_rate AFTER UPDATE ON public.products FOR EACH ROW EXECUTE FUNCTION public.sync_product_photographer_rate();
CREATE FUNCTION public.enforce_linked_unit_rate() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$ BEGIN
 IF NEW.unit_rate_product_id IS NOT NULL THEN SELECT photographer_unit_rate INTO NEW.hourly_rate FROM public.products WHERE id=NEW.unit_rate_product_id; NEW.rate_mode='hourly'; NEW.fixed_rate=NULL; END IF; RETURN NEW; END $$;
CREATE TRIGGER enforce_linked_unit_rate BEFORE INSERT OR UPDATE ON public.pay_rate_card FOR EACH ROW EXECUTE FUNCTION public.enforce_linked_unit_rate();
CREATE TABLE public.quote_lighting_pay(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),quote_item_id uuid NOT NULL UNIQUE REFERENCES public.quote_items(id) ON DELETE CASCADE,assignment_id uuid NOT NULL REFERENCES public.event_assignments(id) ON DELETE CASCADE,unit_rate numeric NOT NULL CHECK(unit_rate>=0),created_at timestamptz NOT NULL DEFAULT now());
GRANT SELECT ON public.quote_lighting_pay TO authenticated;
GRANT ALL ON public.quote_lighting_pay TO service_role;
ALTER TABLE public.quote_lighting_pay ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Managers and recipient read lighting pay" ON public.quote_lighting_pay FOR SELECT TO authenticated USING(public.has_role(auth.uid(),'admin') OR public.can_access_operations(auth.uid()) OR EXISTS(SELECT 1 FROM public.event_assignments a WHERE a.id=assignment_id AND a.user_id=auth.uid()));
CREATE FUNCTION public.allocate_lighting_pay(_quote_item_id uuid,_assignment_id uuid DEFAULT NULL) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
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
 SELECT photographer_unit_rate INTO pay_rate FROM public.products WHERE id='22222222-0001-0001-0001-000000000004';
 INSERT INTO public.quote_lighting_pay(quote_item_id,assignment_id,unit_rate) VALUES(_quote_item_id,_assignment_id,pay_rate) ON CONFLICT(quote_item_id) DO UPDATE SET assignment_id=EXCLUDED.assignment_id;
END $$;
REVOKE ALL ON FUNCTION public.allocate_lighting_pay(uuid,uuid) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.allocate_lighting_pay(uuid,uuid) TO authenticated;
COMMENT ON COLUMN public.event_assignments.pay_rate_snapshot IS 'Role rate copied on creation; annual standard changes preserve existing assignment pay.';