CREATE OR REPLACE FUNCTION public.check_staff_conflicts(p_user_id uuid, p_start_at timestamptz, p_end_at timestamptz, p_exclude_event_id uuid DEFAULT NULL)
RETURNS TABLE(event_id uuid,event_name text,start_at timestamptz,end_at timestamptz)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $$
 WITH assigned AS (
 SELECT e.*, a.session_id, a.call_time_at AS assignment_call, a.wrap_time_at AS assignment_wrap
 FROM public.events e JOIN public.event_assignments a ON a.event_id=e.id
 WHERE a.user_id=p_user_id AND e.id IS DISTINCT FROM p_exclude_event_id AND e.ops_status IS DISTINCT FROM 'cancelled'
 ), windows AS (
 SELECT ae.id,ae.event_name,
 COALESCE(ae.assignment_call,(COALESCE(s.session_date,ae.event_date)::text || ' ' || COALESCE(s.arrival_time,s.start_time,ae.start_time,'09:00') || ' ' || COALESCE(s.timezone,ae.timezone,'Australia/Sydney'))::timestamptz) AS w_start,
 COALESCE(ae.assignment_wrap,(COALESCE(s.session_date,ae.event_date)::text || ' ' || COALESCE(s.end_time,ae.end_time,'23:59') || ' ' || COALESCE(s.timezone,ae.timezone,'Australia/Sydney'))::timestamptz) AS w_end
 FROM assigned ae JOIN public.event_sessions s ON s.event_id=ae.id AND (s.id=ae.session_id OR (ae.session_id IS NULL AND s.session_type IS DISTINCT FROM 'post_production'))
 UNION ALL
 SELECT ae.id,ae.event_name,
 COALESCE(ae.assignment_call,ae.start_at,(ae.event_date::text || ' ' || COALESCE(ae.start_time,'09:00') || ' ' || COALESCE(ae.timezone,'Australia/Sydney'))::timestamptz),
 COALESCE(ae.assignment_wrap,ae.end_at,(ae.event_date::text || ' ' || COALESCE(ae.end_time,'23:59') || ' ' || COALESCE(ae.timezone,'Australia/Sydney'))::timestamptz)
 FROM assigned ae WHERE ae.session_id IS NULL AND NOT EXISTS (SELECT 1 FROM public.event_sessions s WHERE s.event_id=ae.id AND s.session_type IS DISTINCT FROM 'post_production')
 ) SELECT w.id,w.event_name,min(w.w_start),max(w.w_end) FROM windows w
 WHERE (p_start_at,COALESCE(p_end_at,p_start_at+interval '2 hours')) OVERLAPS (w.w_start,w.w_end)
 GROUP BY w.id,w.event_name;
$$;