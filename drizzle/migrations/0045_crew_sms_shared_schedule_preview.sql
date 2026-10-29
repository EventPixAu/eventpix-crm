DO $$ DECLARE definition text; BEGIN
 SELECT pg_get_functiondef('public.crew_sms_candidates()'::regprocedure) INTO definition;
 IF position('c.due <= now() AND c.due > now()-interval ''65 minutes''' in definition)=0 THEN RAISE EXCEPTION 'Expected SMS window not found'; END IF;
 definition := replace(definition,'public.crew_sms_candidates()','public.crew_sms_schedule(_from timestamptz, _until timestamptz)');
 definition := replace(definition,'AND cfg.enabled','');
 definition := replace(definition,'c.due <= now() AND c.due > now()-interval ''65 minutes''','c.due >= _from AND c.due < _until');
 EXECUTE definition;
END $$;
REVOKE ALL ON FUNCTION public.crew_sms_schedule(timestamptz,timestamptz) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.crew_sms_schedule(timestamptz,timestamptz) TO service_role;
CREATE OR REPLACE FUNCTION public.crew_sms_candidates() RETURNS TABLE(event_id uuid,session_key text,recipient_key text,reminder_type text,due_at timestamptz,phone text,event_name text,venue_name text,setup_at timestamptz,finish_at timestamptz,timezone text) LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public AS $$
 SELECT s.* FROM public.crew_sms_schedule(now()-interval '65 minutes',now()+interval '1 microsecond') s
 WHERE s.due_at > now()-interval '65 minutes' AND s.due_at <= now()
 AND EXISTS(SELECT 1 FROM public.crew_sms_settings cfg WHERE cfg.id=true AND cfg.enabled);
$$;
REVOKE ALL ON FUNCTION public.crew_sms_candidates() FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.crew_sms_candidates() TO service_role;
COMMENT ON FUNCTION public.crew_sms_schedule(timestamptz,timestamptz) IS 'Shared SMS timing and eligibility for sending and admin upcoming previews; no writes or delivery. Preview may show paused reminders; caller excludes existing claims and invalid phones.';