ALTER TABLE public.lead_delivery_preferences ADD COLUMN onsite_contact_name text, ADD COLUMN onsite_contact_phone text, ADD COLUMN onsite_contact_email text, ADD COLUMN special_instructions text;
ALTER TABLE public.event_delivery_preferences ADD COLUMN onsite_contact_name text, ADD COLUMN onsite_contact_phone text, ADD COLUMN onsite_contact_email text, ADD COLUMN special_instructions text;

CREATE OR REPLACE FUNCTION public.get_booking_confirmation_request(p_token uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE result jsonb; details jsonb;
BEGIN
 result := public.get_delivery_choice_request(p_token);
 IF result->>'status' <> 'valid' THEN RETURN result; END IF;
 SELECT jsonb_build_object('onsite_contact_name', onsite_contact_name, 'onsite_contact_phone', onsite_contact_phone, 'onsite_contact_email', onsite_contact_email, 'special_instructions', special_instructions) INTO details
 FROM public.event_delivery_preferences WHERE response_token = p_token AND expires_at > now();
 IF NOT FOUND THEN
 SELECT jsonb_build_object('onsite_contact_name', coalesce(e.onsite_contact_name,l.onsite_contact_name), 'onsite_contact_phone', coalesce(e.onsite_contact_phone,l.onsite_contact_phone), 'onsite_contact_email', coalesce(e.onsite_contact_email,l.onsite_contact_email), 'special_instructions', coalesce(e.special_instructions,l.special_instructions)) INTO details
 FROM public.lead_delivery_preferences l LEFT JOIN public.event_delivery_preferences e ON e.event_id=l.event_id WHERE l.response_token = p_token AND l.expires_at > now();
 END IF;
 RETURN result || coalesce(details,'{}'::jsonb);
END $$;
REVOKE ALL ON FUNCTION public.get_booking_confirmation_request(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_booking_confirmation_request(uuid) TO anon,authenticated,service_role;

CREATE OR REPLACE FUNCTION public.submit_booking_confirmation(p_token uuid,p_choice text,p_timing text,p_social_media_access boolean,p_branding_notes text,p_onsite_contact_name text,p_onsite_contact_phone text,p_onsite_contact_email text,p_special_instructions text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE result jsonb; target_event uuid;
BEGIN
 IF nullif(trim(p_onsite_contact_name),'') IS NULL OR nullif(trim(p_onsite_contact_phone),'') IS NULL THEN RAISE EXCEPTION 'Please provide the onsite contact name and mobile number'; END IF;
 IF length(p_onsite_contact_name)>200 OR length(p_onsite_contact_phone)>100 OR length(coalesce(p_onsite_contact_email,''))>320 OR length(coalesce(p_special_instructions,''))>4000 THEN RAISE EXCEPTION 'Contact details or instructions are too long'; END IF;
 result := public.submit_delivery_choice(p_token,p_choice,p_timing,p_social_media_access,p_branding_notes);
 IF result->>'status' <> 'confirmed' THEN RETURN result; END IF;
 SELECT event_id INTO target_event FROM public.event_delivery_preferences WHERE response_token=p_token AND expires_at>now();
 IF NOT FOUND THEN
 SELECT event_id INTO target_event FROM public.lead_delivery_preferences WHERE response_token=p_token AND expires_at>now();
 IF target_event IS NULL THEN
 UPDATE public.lead_delivery_preferences SET onsite_contact_name=trim(p_onsite_contact_name),onsite_contact_phone=trim(p_onsite_contact_phone),onsite_contact_email=nullif(trim(p_onsite_contact_email),''),special_instructions=nullif(trim(p_special_instructions),'') WHERE response_token=p_token AND expires_at>now();
 RETURN result;
 END IF;
 END IF;
 UPDATE public.event_delivery_preferences SET onsite_contact_name=trim(p_onsite_contact_name),onsite_contact_phone=trim(p_onsite_contact_phone),onsite_contact_email=nullif(trim(p_onsite_contact_email),''),special_instructions=nullif(trim(p_special_instructions),'') WHERE event_id=target_event;
 RETURN result;
END $$;
REVOKE ALL ON FUNCTION public.submit_booking_confirmation(uuid,text,text,boolean,text,text,text,text,text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.submit_booking_confirmation(uuid,text,text,boolean,text,text,text,text,text) TO anon,authenticated,service_role;

CREATE OR REPLACE FUNCTION public.carry_lead_delivery_choice()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE r public.lead_delivery_preferences;
BEGIN
 IF NEW.lead_id IS NULL THEN RETURN NEW; END IF;
 SELECT * INTO r FROM public.lead_delivery_preferences WHERE lead_id=NEW.lead_id FOR UPDATE;
 IF NOT FOUND OR (r.event_id IS NOT NULL AND r.event_id<>NEW.id) THEN RETURN NEW; END IF;
 INSERT INTO public.event_delivery_preferences(event_id,response_token,expires_at,choice,timing,social_media_access,branding_notes,confirmed_at,requested_at,onsite_contact_name,onsite_contact_phone,onsite_contact_email,special_instructions)
 VALUES(NEW.id,r.response_token,r.expires_at,r.choice,r.timing,r.social_media_access,r.branding_notes,r.confirmed_at,r.requested_at,r.onsite_contact_name,r.onsite_contact_phone,r.onsite_contact_email,r.special_instructions) ON CONFLICT(event_id) DO NOTHING;
 UPDATE public.lead_delivery_preferences SET event_id=NEW.id WHERE lead_id=NEW.lead_id;
 RETURN NEW;
END $$;