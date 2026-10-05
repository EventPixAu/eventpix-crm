CREATE TABLE public.event_delivery_preferences (
 event_id uuid PRIMARY KEY REFERENCES public.events(id) ON DELETE CASCADE,
 response_token uuid NOT NULL DEFAULT gen_random_uuid() UNIQUE,
 expires_at timestamptz NOT NULL DEFAULT (now() + interval '90 days'),
 choice text CHECK (choice IN ('dropbox_only','post_event_gallery','facial_private','facial_public')),
 timing text CHECK (timing IN ('immediate','delayed')),
 social_media_access boolean NOT NULL DEFAULT false,
 branding_notes text,
 confirmed_at timestamptz,
 requested_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.event_delivery_preferences TO authenticated;
GRANT ALL ON public.event_delivery_preferences TO service_role;
ALTER TABLE public.event_delivery_preferences ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Internal users view delivery preferences" ON public.event_delivery_preferences FOR SELECT TO authenticated USING (public.can_access_operations(auth.uid()) OR public.can_access_sales(auth.uid()) OR public.is_executive(auth.uid()) OR public.is_assigned_to_event(auth.uid(),event_id));
CREATE OR REPLACE FUNCTION public.prepare_delivery_choice_request(p_event_id uuid) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE r public.event_delivery_preferences;
BEGIN
 IF NOT (public.can_access_operations(auth.uid()) OR public.can_access_sales(auth.uid())) THEN RAISE EXCEPTION 'Not authorized'; END IF;
 IF NOT EXISTS(SELECT 1 FROM public.events WHERE id=p_event_id) THEN RAISE EXCEPTION 'Event not found'; END IF;
 INSERT INTO public.event_delivery_preferences(event_id) VALUES(p_event_id) ON CONFLICT(event_id) DO UPDATE SET response_token=CASE WHEN event_delivery_preferences.expires_at < now() THEN gen_random_uuid() ELSE event_delivery_preferences.response_token END, expires_at=now()+interval '90 days', requested_at=now() RETURNING * INTO r;
 RETURN jsonb_build_object('token',r.response_token,'expires_at',r.expires_at);
END $$;
REVOKE ALL ON FUNCTION public.prepare_delivery_choice_request(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.prepare_delivery_choice_request(uuid) TO authenticated;
CREATE OR REPLACE FUNCTION public.get_delivery_choice_request(p_token uuid) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE r public.event_delivery_preferences; e public.events;
BEGIN
 SELECT * INTO r FROM public.event_delivery_preferences WHERE response_token=p_token AND expires_at>now();
 IF NOT FOUND THEN RETURN jsonb_build_object('status','invalid'); END IF;
 SELECT * INTO e FROM public.events WHERE id=r.event_id;
 RETURN jsonb_build_object('status','valid','event_name',e.event_name,'event_date',e.event_date,'choice',r.choice,'timing',r.timing,'social_media_access',r.social_media_access,'branding_notes',r.branding_notes,'confirmed_at',r.confirmed_at);
END $$;
REVOKE ALL ON FUNCTION public.get_delivery_choice_request(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_delivery_choice_request(uuid) TO anon,authenticated;
CREATE OR REPLACE FUNCTION public.submit_delivery_choice(p_token uuid,p_choice text,p_timing text,p_social_media_access boolean,p_branding_notes text) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE r public.event_delivery_preferences;
BEGIN
 IF p_choice IS NULL OR p_choice NOT IN ('dropbox_only','post_event_gallery','facial_private','facial_public') THEN RAISE EXCEPTION 'Please choose a delivery option'; END IF;
 IF p_choice IN ('facial_private','facial_public') AND (p_timing IS NULL OR p_timing NOT IN ('immediate','delayed')) THEN RAISE EXCEPTION 'Please choose immediate or delayed delivery'; END IF;
 IF length(coalesce(p_branding_notes,''))>2000 THEN RAISE EXCEPTION 'Notes must be 2000 characters or fewer'; END IF;
 SELECT * INTO r FROM public.event_delivery_preferences WHERE response_token=p_token AND expires_at>now() FOR UPDATE;
 IF NOT FOUND THEN RETURN jsonb_build_object('status','invalid'); END IF;
 UPDATE public.event_delivery_preferences SET choice=p_choice,timing=CASE WHEN p_choice IN ('facial_private','facial_public') THEN p_timing ELSE NULL END,social_media_access=coalesce(p_social_media_access,false),branding_notes=nullif(trim(p_branding_notes),''),confirmed_at=now() WHERE event_id=r.event_id;
 RETURN jsonb_build_object('status','confirmed');
END $$;
REVOKE ALL ON FUNCTION public.submit_delivery_choice(uuid,text,text,boolean,text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.submit_delivery_choice(uuid,text,text,boolean,text) TO anon,authenticated;