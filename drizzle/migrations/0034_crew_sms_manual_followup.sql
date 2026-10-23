ALTER TABLE public.crew_sms_logs DROP CONSTRAINT IF EXISTS crew_sms_logs_reminder_type_check;
ALTER TABLE public.crew_sms_logs ADD CONSTRAINT crew_sms_logs_reminder_type_check CHECK (reminder_type IN ('setup','delivery','followup'));

CREATE OR REPLACE FUNCTION public.crew_sms_followup_recipients(_event_id uuid)
RETURNS TABLE(event_id uuid, session_key text, recipient_key text, phone text, event_name text, venue_name text, finish_at timestamptz, timezone text, masv boolean)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public AS $$
WITH base AS (
SELECT e.id AS eid,coalesce(s.id::text,'event') AS skey,coalesce(a.user_id,st.user_id,a.staff_id)::text AS rkey,
coalesce(nullif(p.phone,''),nullif(lp.phone,''),st.phone) AS mobile,e.event_name,coalesce(s.venue_name,e.venue_name) AS venue,
coalesce(s.timezone,e.timezone,'Australia/Sydney') AS tz,coalesce(s.session_date,e.event_date) AS d,
CASE WHEN (SELECT count(*) FROM public.event_sessions c WHERE c.event_id=e.id)>1 THEN coalesce(s.arrival_time,CASE WHEN e.setup_time ~ '^\d{2}:\d{2}(:\d{2})?$' THEN e.setup_time::time END) ELSE coalesce(CASE WHEN e.setup_time ~ '^\d{2}:\d{2}(:\d{2})?$' THEN e.setup_time::time END,s.arrival_time) END AS setup,
coalesce(s.end_time,e.end_time) AS finish,coalesce(s.start_time,e.start_time) AS start,e.crew_sms_masv_delivery AS masv
FROM public.events e JOIN public.event_assignments a ON a.event_id=e.id
JOIN public.staff_roles r ON r.id=a.staff_role_id AND r.is_onsite=true AND r.name !~* '\mstaff\M'
LEFT JOIN public.staff st ON st.id=a.staff_id LEFT JOIN public.profiles p ON p.id=a.user_id LEFT JOIN public.profiles lp ON lp.id=st.user_id
LEFT JOIN public.event_sessions s ON s.event_id=e.id AND (a.session_id IS NULL OR a.session_id=s.id)
WHERE e.id=_event_id AND coalesce(e.ops_status,'') <> 'cancelled' AND a.confirmation_status='confirmed'
AND coalesce(p.is_active,lp.is_active,true) AND coalesce(st.status::text,'active')='active'
), times AS (
SELECT *, ((d+finish)+CASE WHEN finish<coalesce(start,setup) THEN interval '1 day' ELSE interval '0' END) AT TIME ZONE tz AS finish_instant FROM base
)
SELECT DISTINCT eid,skey,rkey,mobile,event_name,venue,finish_instant,tz,masv FROM times;
$$;
REVOKE ALL ON FUNCTION public.crew_sms_followup_recipients(uuid) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.crew_sms_followup_recipients(uuid) TO service_role;
COMMENT ON FUNCTION public.crew_sms_followup_recipients(uuid) IS 'Manual follow-up texts: confirmed onsite crew for one event, regardless of schedule; cancelled events and offsite or declined assignments excluded.';