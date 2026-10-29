CREATE TABLE public.crew_sms_disabled_reminders (
 event_id uuid NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
 session_key text NOT NULL,
 recipient_key text NOT NULL,
 reminder_type text NOT NULL CHECK (reminder_type IN ('setup','delivery')),
 disabled_at timestamptz NOT NULL DEFAULT now(),
 PRIMARY KEY(event_id,session_key,recipient_key,reminder_type)
);
GRANT SELECT ON public.crew_sms_disabled_reminders TO authenticated;
GRANT ALL ON public.crew_sms_disabled_reminders TO service_role;
ALTER TABLE public.crew_sms_disabled_reminders ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins can read disabled SMS" ON public.crew_sms_disabled_reminders FOR SELECT TO authenticated USING (public.has_role(auth.uid(),'admin'));
CREATE OR REPLACE FUNCTION public.set_crew_sms_reminder_enabled(_event_id uuid,_session_key text,_recipient_key text,_reminder_type text,_enabled boolean) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
BEGIN
 IF auth.uid() IS NULL OR NOT public.has_role(auth.uid(),'admin') THEN RAISE EXCEPTION 'Admin access required' USING ERRCODE='42501'; END IF;
 IF _enabled IS NULL OR _session_key IS NULL OR _recipient_key IS NULL OR _session_key='' OR _recipient_key='' OR _reminder_type IS NULL OR _reminder_type NOT IN ('setup','delivery') THEN RAISE EXCEPTION 'Invalid reminder'; END IF;
 IF EXISTS(SELECT 1 FROM public.crew_sms_logs l WHERE l.event_id=_event_id AND l.session_key=_session_key AND l.recipient_key=_recipient_key AND l.reminder_type=_reminder_type) THEN RAISE EXCEPTION 'This text is already being sent or has been processed'; END IF;
 IF _enabled THEN
  DELETE FROM public.crew_sms_disabled_reminders d WHERE d.event_id=_event_id AND d.session_key=_session_key AND d.recipient_key=_recipient_key AND d.reminder_type=_reminder_type;
 ELSE
  INSERT INTO public.crew_sms_disabled_reminders(event_id,session_key,recipient_key,reminder_type) VALUES(_event_id,_session_key,_recipient_key,_reminder_type) ON CONFLICT DO NOTHING;
 END IF;
END $$;
REVOKE ALL ON FUNCTION public.set_crew_sms_reminder_enabled(uuid,text,text,text,boolean) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.set_crew_sms_reminder_enabled(uuid,text,text,text,boolean) TO authenticated;
CREATE OR REPLACE FUNCTION public.crew_sms_candidates() RETURNS TABLE(event_id uuid,session_key text,recipient_key text,reminder_type text,due_at timestamptz,phone text,event_name text,venue_name text,setup_at timestamptz,finish_at timestamptz,timezone text) LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public AS $$
 SELECT s.* FROM public.crew_sms_schedule(now()-interval '65 minutes',now()+interval '1 microsecond') s
 WHERE s.due_at > now()-interval '65 minutes' AND s.due_at <= now()
 AND EXISTS(SELECT 1 FROM public.crew_sms_settings cfg WHERE cfg.id=true AND cfg.enabled)
 AND NOT EXISTS(SELECT 1 FROM public.crew_sms_disabled_reminders d WHERE d.event_id=s.event_id AND d.session_key=s.session_key AND d.recipient_key=s.recipient_key AND d.reminder_type=s.reminder_type);
$$;
REVOKE ALL ON FUNCTION public.crew_sms_candidates() FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.crew_sms_candidates() TO service_role;
COMMENT ON TABLE public.crew_sms_disabled_reminders IS 'Individual automatic SMS off switches; schedule previews retain these rows, sender candidates and post-claim rechecks exclude them. Manual follow-ups are separate.';