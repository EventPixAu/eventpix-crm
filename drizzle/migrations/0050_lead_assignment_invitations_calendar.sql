ALTER TABLE public.lead_assignments ADD COLUMN IF NOT EXISTS notification_sent_at timestamptz, ADD COLUMN IF NOT EXISTS notification_error text;
CREATE OR REPLACE FUNCTION public.lead_calendar_holds(_user_id uuid DEFAULT auth.uid())
RETURNS TABLE(assignment_id uuid, lead_id uuid, session_id uuid, lead_name text, session_label text, session_date date, arrival_time time, start_time time, end_time time, timezone text, venue_name text)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public AS $$
 SELECT a.id,l.id,s.id,l.lead_name,s.label,
 coalesce(s.session_date,l.estimated_event_date,(l.main_shoot_start_at AT TIME ZONE 'Australia/Sydney')::date),
 s.arrival_time,coalesce(s.start_time,(l.main_shoot_start_at AT TIME ZONE 'Australia/Sydney')::time),
 coalesce(s.end_time,(l.main_shoot_end_at AT TIME ZONE 'Australia/Sydney')::time),
 coalesce(s.timezone,'Australia/Sydney'),coalesce(s.venue_name,l.venue_text)
 FROM public.lead_assignments a JOIN public.leads l ON l.id=a.lead_id
 LEFT JOIN public.event_sessions s ON s.lead_id=l.id AND (a.session_id IS NULL OR a.session_id=s.id) AND coalesce(s.session_type,'')<>'post_production'
 WHERE a.user_id=_user_id AND (auth.role()='service_role' OR auth.uid()=_user_id OR public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'operations') OR public.has_role(auth.uid(),'sales'))
 AND l.converted_job_id IS NULL AND l.status NOT IN ('lost','won','converted','on_hold_date_tba')
 AND a.confirmation_status='on_hold'
 AND (s.id IS NOT NULL OR (a.session_id IS NULL AND NOT EXISTS (SELECT 1 FROM public.event_sessions es WHERE es.lead_id=l.id)))
 AND coalesce(s.session_date,l.estimated_event_date,(l.main_shoot_start_at AT TIME ZONE 'Australia/Sydney')::date) IS NOT NULL;
$$;
REVOKE ALL ON FUNCTION public.lead_calendar_holds(uuid) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.lead_calendar_holds(uuid) TO authenticated,service_role;