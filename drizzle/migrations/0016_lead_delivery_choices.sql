CREATE TABLE public.lead_delivery_preferences (
 lead_id uuid PRIMARY KEY REFERENCES public.leads(id) ON DELETE CASCADE,
 event_id uuid REFERENCES public.events(id) ON DELETE SET NULL,
 response_token uuid NOT NULL UNIQUE DEFAULT gen_random_uuid(),
 expires_at timestamptz NOT NULL DEFAULT now()+interval '90 days',
 choice text CHECK(choice IN ('dropbox_only','post_event_gallery','facial_private','facial_public')),
 timing text CHECK(timing IN ('immediate','delayed')),
 social_media_access boolean NOT NULL DEFAULT false,
 branding_notes text,
 confirmed_at timestamptz,
 requested_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.lead_delivery_preferences TO authenticated;
GRANT ALL ON public.lead_delivery_preferences TO service_role;
ALTER TABLE public.lead_delivery_preferences ENABLE ROW LEVEL SECURITY;
CREATE POLICY lead_delivery_staff_read ON public.lead_delivery_preferences FOR SELECT TO authenticated USING(public.can_access_sales(auth.uid()) OR public.can_access_operations(auth.uid()));
CREATE OR REPLACE FUNCTION public.prepare_lead_delivery_choice_request(p_lead_id uuid) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE r public.lead_delivery_preferences; v_event uuid;
BEGIN
 IF NOT(public.can_access_sales(auth.uid()) OR public.can_access_operations(auth.uid())) THEN RAISE EXCEPTION 'Not authorized'; END IF;
 IF NOT EXISTS(SELECT 1 FROM public.leads WHERE id=p_lead_id) THEN RAISE EXCEPTION 'Lead not found'; END IF;
 SELECT id INTO v_event FROM public.events WHERE lead_id=p_lead_id ORDER BY created_at LIMIT 1;
 IF v_event IS NOT NULL THEN RETURN public.prepare_delivery_choice_request(v_event) || jsonb_build_object('event_id',v_event); END IF;
 INSERT INTO public.lead_delivery_preferences(lead_id) VALUES(p_lead_id) ON CONFLICT(lead_id) DO UPDATE SET response_token=CASE WHEN lead_delivery_preferences.expires_at<now() THEN gen_random_uuid() ELSE lead_delivery_preferences.response_token END, expires_at=now()+interval '90 days',requested_at=now() RETURNING * INTO r;
 RETURN jsonb_build_object('token',r.response_token,'expires_at',r.expires_at);
END $$;
REVOKE ALL ON FUNCTION public.prepare_lead_delivery_choice_request(uuid) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.prepare_lead_delivery_choice_request(uuid) TO authenticated,service_role;
CREATE OR REPLACE FUNCTION public.carry_lead_delivery_choice() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE r public.lead_delivery_preferences;
BEGIN
 IF NEW.lead_id IS NULL THEN RETURN NEW; END IF;
 SELECT * INTO r FROM public.lead_delivery_preferences WHERE lead_id=NEW.lead_id FOR UPDATE;
 IF NOT FOUND OR (r.event_id IS NOT NULL AND r.event_id<>NEW.id) THEN RETURN NEW; END IF;
 INSERT INTO public.event_delivery_preferences(event_id,response_token,expires_at,choice,timing,social_media_access,branding_notes,confirmed_at,requested_at) VALUES(NEW.id,r.response_token,r.expires_at,r.choice,r.timing,r.social_media_access,r.branding_notes,r.confirmed_at,r.requested_at) ON CONFLICT(event_id) DO NOTHING;
 UPDATE public.lead_delivery_preferences SET event_id=NEW.id WHERE lead_id=NEW.lead_id;
 RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION public.carry_lead_delivery_choice() FROM PUBLIC,anon,authenticated;
CREATE TRIGGER carry_lead_delivery_choice AFTER INSERT OR UPDATE OF lead_id ON public.events FOR EACH ROW EXECUTE FUNCTION public.carry_lead_delivery_choice();
CREATE OR REPLACE FUNCTION public.get_delivery_choice_request(p_token uuid) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE r public.event_delivery_preferences; l public.lead_delivery_preferences; e public.events; v_lead public.leads;
BEGIN
 SELECT * INTO r FROM public.event_delivery_preferences WHERE response_token=p_token AND expires_at>now();
 IF FOUND THEN
 SELECT * INTO e FROM public.events WHERE id=r.event_id;
 RETURN jsonb_build_object('status','valid','event_name',e.event_name,'event_date',e.event_date,'choice',r.choice,'timing',r.timing,'social_media_access',r.social_media_access,'branding_notes',r.branding_notes,'confirmed_at',r.confirmed_at);
 END IF;
 SELECT * INTO l FROM public.lead_delivery_preferences WHERE response_token=p_token AND expires_at>now();
 IF NOT FOUND THEN RETURN jsonb_build_object('status','invalid'); END IF;
 IF l.event_id IS NOT NULL THEN
 SELECT * INTO r FROM public.event_delivery_preferences WHERE event_id=l.event_id;
 SELECT * INTO e FROM public.events WHERE id=l.event_id;
 RETURN jsonb_build_object('status','valid','event_name',e.event_name,'event_date',e.event_date,'choice',r.choice,'timing',r.timing,'social_media_access',r.social_media_access,'branding_notes',r.branding_notes,'confirmed_at',r.confirmed_at);
 END IF;
 SELECT * INTO v_lead FROM public.leads WHERE id=l.lead_id;
 RETURN jsonb_build_object('status','valid','event_name',v_lead.lead_name,'event_date',v_lead.estimated_event_date,'choice',l.choice,'timing',l.timing,'social_media_access',l.social_media_access,'branding_notes',l.branding_notes,'confirmed_at',l.confirmed_at);
END $$;
CREATE OR REPLACE FUNCTION public.submit_delivery_choice(p_token uuid,p_choice text,p_timing text,p_social_media_access boolean,p_branding_notes text) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE r public.event_delivery_preferences; l public.lead_delivery_preferences;
BEGIN
 IF p_choice IS NULL OR p_choice NOT IN ('dropbox_only','post_event_gallery','facial_private','facial_public') THEN RAISE EXCEPTION 'Please choose a delivery option'; END IF;
 IF p_choice IN ('facial_private','facial_public') AND (p_timing IS NULL OR p_timing NOT IN ('immediate','delayed')) THEN RAISE EXCEPTION 'Please choose immediate or delayed delivery'; END IF;
 IF length(coalesce(p_branding_notes,''))>2000 THEN RAISE EXCEPTION 'Notes must be 2000 characters or fewer'; END IF;
 SELECT * INTO r FROM public.event_delivery_preferences WHERE response_token=p_token AND expires_at>now() FOR UPDATE;
 IF NOT FOUND THEN
 SELECT * INTO l FROM public.lead_delivery_preferences WHERE response_token=p_token AND expires_at>now() FOR UPDATE;
 IF NOT FOUND THEN RETURN jsonb_build_object('status','invalid'); END IF;
 IF l.event_id IS NOT NULL THEN SELECT * INTO r FROM public.event_delivery_preferences WHERE event_id=l.event_id FOR UPDATE;
 ELSE
 UPDATE public.lead_delivery_preferences SET choice=p_choice,timing=CASE WHEN p_choice IN ('facial_private','facial_public') THEN p_timing ELSE NULL END,social_media_access=coalesce(p_social_media_access,false),branding_notes=nullif(trim(p_branding_notes),''),confirmed_at=now() WHERE lead_id=l.lead_id;
 RETURN jsonb_build_object('status','confirmed');
 END IF;
 END IF;
 UPDATE public.event_delivery_preferences SET choice=p_choice,timing=CASE WHEN p_choice IN ('facial_private','facial_public') THEN p_timing ELSE NULL END,social_media_access=coalesce(p_social_media_access,false),branding_notes=nullif(trim(p_branding_notes),''),confirmed_at=now() WHERE event_id=r.event_id;
 RETURN jsonb_build_object('status','confirmed');
END $$;