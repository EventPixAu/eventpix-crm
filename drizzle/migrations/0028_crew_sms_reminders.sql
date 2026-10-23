CREATE TABLE public.crew_sms_settings (id boolean PRIMARY KEY DEFAULT true CHECK (id), enabled boolean NOT NULL DEFAULT false, enabled_at timestamptz NOT NULL DEFAULT now());
GRANT SELECT ON public.crew_sms_settings TO authenticated;
GRANT ALL ON public.crew_sms_settings TO service_role;
ALTER TABLE public.crew_sms_settings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins read SMS settings" ON public.crew_sms_settings FOR SELECT TO authenticated USING(public.has_role(auth.uid(),'admin'));
CREATE TABLE public.crew_sms_logs (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), event_id uuid NOT NULL REFERENCES public.events(id) ON DELETE CASCADE, session_key text NOT NULL, recipient_key text NOT NULL, reminder_type text NOT NULL CHECK(reminder_type IN ('setup','delivery')), due_at timestamptz NOT NULL, phone text NOT NULL, body text NOT NULL, status text NOT NULL DEFAULT 'sending' CHECK(status IN ('sending','sent','failed','unknown','skipped')), provider_message_id text, error_code text, created_at timestamptz NOT NULL DEFAULT now(), sent_at timestamptz, UNIQUE(event_id,session_key,recipient_key,reminder_type));
GRANT SELECT ON public.crew_sms_logs TO authenticated;
GRANT ALL ON public.crew_sms_logs TO service_role;
ALTER TABLE public.crew_sms_logs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins read crew SMS logs" ON public.crew_sms_logs FOR SELECT TO authenticated USING(public.has_role(auth.uid(),'admin'));
CREATE TABLE public.crew_sms_dispatch_tickets (token uuid PRIMARY KEY DEFAULT gen_random_uuid(), created_at timestamptz NOT NULL DEFAULT now());
GRANT ALL ON public.crew_sms_dispatch_tickets TO service_role;
ALTER TABLE public.crew_sms_dispatch_tickets ENABLE ROW LEVEL SECURITY;
CREATE OR REPLACE FUNCTION public.consume_crew_sms_ticket(_token uuid) RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$ DECLARE found_token uuid; BEGIN DELETE FROM public.crew_sms_dispatch_tickets WHERE token=_token AND created_at > now()-interval '2 minutes' RETURNING token INTO found_token; RETURN found_token IS NOT NULL; END; $$;
REVOKE ALL ON FUNCTION public.consume_crew_sms_ticket(uuid) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.consume_crew_sms_ticket(uuid) TO service_role;
CREATE OR REPLACE FUNCTION public.crew_sms_candidates() RETURNS TABLE(event_id uuid,session_key text,recipient_key text,reminder_type text,due_at timestamptz,phone text,event_name text,venue_name text,setup_at timestamptz,finish_at timestamptz,timezone text) LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public AS $$
WITH base AS (
SELECT e.id AS eid,coalesce(s.id::text,'event') AS skey,coalesce(a.user_id,st.user_id,a.staff_id)::text AS rkey,
coalesce(nullif(p.phone,''),nullif(lp.phone,''),st.phone) AS mobile,e.event_name,coalesce(s.venue_name,e.venue_name) AS venue,
coalesce(s.timezone,e.timezone,'Australia/Sydney') AS tz,coalesce(s.session_date,e.event_date) AS d,
CASE WHEN (SELECT count(*) FROM public.event_sessions c WHERE c.event_id=e.id)>1 THEN coalesce(s.arrival_time,CASE WHEN e.setup_time ~ '^\d{2}:\d{2}(:\d{2})?$' THEN e.setup_time::time END) ELSE coalesce(CASE WHEN e.setup_time ~ '^\d{2}:\d{2}(:\d{2})?$' THEN e.setup_time::time END,s.arrival_time) END AS setup,
coalesce(s.end_time,e.end_time) AS finish,coalesce(s.start_time,e.start_time) AS start
FROM public.events e JOIN public.event_assignments a ON a.event_id=e.id
JOIN public.staff_roles r ON r.id=a.staff_role_id AND r.is_onsite=true AND r.name !~* '\mstaff\M'
LEFT JOIN public.staff st ON st.id=a.staff_id LEFT JOIN public.profiles p ON p.id=a.user_id LEFT JOIN public.profiles lp ON lp.id=st.user_id
LEFT JOIN public.event_sessions s ON s.event_id=e.id AND (a.session_id IS NULL OR a.session_id=s.id)
WHERE coalesce(e.ops_status,'') <> 'cancelled' AND a.confirmation_status='confirmed'
AND coalesce(p.is_active,lp.is_active,true) AND coalesce(st.status::text,'active')='active'
AND coalesce(s.session_date,e.event_date) BETWEEN (now() AT TIME ZONE 'UTC')::date-2 AND (now() AT TIME ZONE 'UTC')::date+3
), times AS (
SELECT *, (d+setup) AT TIME ZONE tz AS setup_instant,
((d+finish)+CASE WHEN finish<coalesce(start,setup) THEN interval '1 day' ELSE interval '0' END) AT TIME ZONE tz AS finish_instant FROM base
), candidates AS (
SELECT DISTINCT eid,skey,rkey,mobile,event_name,venue,tz,setup_instant,finish_instant,k.kind,
CASE WHEN k.kind='setup' THEN setup_instant-interval '24 hours' ELSE finish_instant END AS due
FROM times CROSS JOIN (VALUES ('setup'),('delivery')) k(kind)
)
SELECT c.eid,c.skey,c.rkey,c.kind,c.due,c.mobile,c.event_name,c.venue,c.setup_instant,c.finish_instant,c.tz
FROM candidates c JOIN public.crew_sms_settings cfg ON cfg.id=true AND cfg.enabled
WHERE c.mobile IS NOT NULL AND c.rkey IS NOT NULL AND c.due >= cfg.enabled_at AND c.due <= now() AND c.due > now()-interval '10 minutes'; $$;
REVOKE ALL ON FUNCTION public.crew_sms_candidates() FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.crew_sms_candidates() TO service_role;