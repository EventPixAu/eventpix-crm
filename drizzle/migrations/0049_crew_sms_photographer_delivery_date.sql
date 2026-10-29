CREATE OR REPLACE FUNCTION public.crew_sms_schedule(_from timestamptz, _until timestamptz)
RETURNS TABLE(event_id uuid, session_key text, recipient_key text, reminder_type text, due_at timestamptz, phone text, event_name text, venue_name text, setup_at timestamptz, finish_at timestamptz, timezone text)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $function$
WITH base AS (
SELECT e.id AS eid,coalesce(s.id::text,'event') AS skey,coalesce(a.user_id,st.user_id,a.staff_id)::text AS rkey,
coalesce(nullif(p.phone,''),nullif(lp.phone,''),st.phone) AS mobile,e.event_name,coalesce(s.venue_name,e.venue_name) AS venue,
coalesce(s.timezone,e.timezone,'Australia/Sydney') AS tz,coalesce(s.session_date,e.event_date) AS d,
CASE WHEN (SELECT count(*) FROM public.event_sessions c WHERE c.event_id=e.id AND c.session_type IS DISTINCT FROM 'post_production')>1 THEN coalesce(s.arrival_time,CASE WHEN e.setup_time ~ '^\d{2}:\d{2}(:\d{2})?$' THEN e.setup_time::time END) ELSE coalesce(CASE WHEN e.setup_time ~ '^\d{2}:\d{2}(:\d{2})?$' THEN e.setup_time::time END,s.arrival_time) END AS setup,
coalesce(s.end_time,e.end_time) AS finish,coalesce(s.start_time,e.start_time) AS start,
e.delivery_deadline_photographer AS photographer_date,editing.editing_at
FROM public.events e JOIN public.event_assignments a ON a.event_id=e.id
JOIN public.staff_roles r ON r.id=a.staff_role_id AND r.is_onsite=true AND r.name !~* '\mstaff\M'
LEFT JOIN public.staff st ON st.id=a.staff_id LEFT JOIN public.profiles p ON p.id=a.user_id LEFT JOIN public.profiles lp ON lp.id=st.user_id
LEFT JOIN public.event_sessions s ON s.event_id=e.id AND s.session_type IS DISTINCT FROM 'post_production' AND (a.session_id IS NULL OR a.session_id=s.id)
LEFT JOIN LATERAL (
 SELECT min((ed.session_date+coalesce(ed.start_time,ed.arrival_time)) AT TIME ZONE coalesce(ed.timezone,e.timezone,'Australia/Sydney')) AS editing_at
 FROM public.event_sessions ed WHERE ed.event_id=e.id AND ed.session_type='post_production'
) editing ON true
WHERE coalesce(e.ops_status,'') <> 'cancelled' AND a.confirmation_status='confirmed'
AND coalesce(p.is_active,lp.is_active,true) AND coalesce(st.status::text,'active')='active'
AND (a.session_id IS NULL OR s.id IS NOT NULL)
), times AS (
SELECT *, (d+setup) AT TIME ZONE tz AS setup_instant,
((d+finish)+CASE WHEN finish<coalesce(start,setup) THEN interval '1 day' ELSE interval '0' END) AT TIME ZONE tz AS finish_instant FROM base
), candidates AS (
SELECT DISTINCT eid,skey,rkey,mobile,event_name,venue,tz,setup_instant,finish_instant,k.kind,
CASE WHEN k.kind='setup' THEN setup_instant-interval '24 hours'
 WHEN photographer_date IS NOT NULL THEN greatest(((photographer_date+time '09:00') AT TIME ZONE tz)-interval '24 hours',finish_instant)
 WHEN editing_at IS NOT NULL THEN greatest(editing_at-interval '24 hours',finish_instant)
 ELSE finish_instant END AS due
FROM times CROSS JOIN (VALUES ('setup'),('delivery')) k(kind)
)
SELECT c.eid,c.skey,c.rkey,c.kind,c.due,c.mobile,c.event_name,c.venue,c.setup_instant,c.finish_instant,c.tz
FROM candidates c JOIN public.crew_sms_settings cfg ON cfg.id=true
WHERE public.crew_sms_event_enabled(c.eid,c.kind) AND c.mobile IS NOT NULL AND c.rkey IS NOT NULL AND c.due >= cfg.enabled_at AND c.due >= _from AND c.due < _until;
$function$;
REVOKE ALL ON FUNCTION public.crew_sms_schedule(timestamptz,timestamptz) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.crew_sms_schedule(timestamptz,timestamptz) TO service_role;