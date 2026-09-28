CREATE OR REPLACE FUNCTION public.check_staff_conflicts(p_user_id uuid, p_start_at timestamp with time zone, p_end_at timestamp with time zone, p_exclude_event_id uuid DEFAULT NULL::uuid)
 RETURNS TABLE(event_id uuid, event_name text, start_at timestamp with time zone, end_at timestamp with time zone)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  WITH assigned_events AS (
    SELECT DISTINCT e.id, e.event_name, e.start_at, e.end_at, e.event_date, e.start_time, e.end_time, e.timezone
    FROM public.events e
    INNER JOIN public.event_assignments ea ON ea.event_id = e.id
    WHERE ea.user_id = p_user_id
      AND e.id IS DISTINCT FROM p_exclude_event_id
      AND e.ops_status IS DISTINCT FROM 'cancelled'
  ),
  windows AS (
    -- Session-level windows (preferred when sessions exist)
    SELECT ae.id, ae.event_name,
      (COALESCE(s.session_date, ae.event_date)::text || ' ' || COALESCE(s.arrival_time, s.start_time, ae.start_time, '09:00') || ' ' || COALESCE(s.timezone, ae.timezone, 'Australia/Sydney'))::timestamptz AS w_start,
      (COALESCE(s.session_date, ae.event_date)::text || ' ' || COALESCE(s.end_time, ae.end_time, '23:59') || ' ' || COALESCE(s.timezone, ae.timezone, 'Australia/Sydney'))::timestamptz AS w_end
    FROM assigned_events ae
    JOIN public.event_sessions s ON s.event_id = ae.id
    UNION ALL
    -- Event-level windows for events without sessions
    SELECT ae.id, ae.event_name,
      COALESCE(ae.start_at,
        (ae.event_date::text || ' ' || COALESCE(ae.start_time, '09:00') || ' ' || COALESCE(ae.timezone, 'Australia/Sydney'))::timestamptz),
      COALESCE(ae.end_at,
        (ae.event_date::text || ' ' || COALESCE(ae.end_time, '23:59') || ' ' || COALESCE(ae.timezone, 'Australia/Sydney'))::timestamptz)
    FROM assigned_events ae
    WHERE NOT EXISTS (SELECT 1 FROM public.event_sessions s WHERE s.event_id = ae.id)
  )
  SELECT DISTINCT w.id AS event_id, w.event_name, min(w.w_start) AS start_at, max(w.w_end) AS end_at
  FROM windows w
  WHERE (p_start_at, COALESCE(p_end_at, p_start_at + interval '2 hours')) OVERLAPS (w.w_start, w.w_end)
  GROUP BY w.id, w.event_name
$function$;