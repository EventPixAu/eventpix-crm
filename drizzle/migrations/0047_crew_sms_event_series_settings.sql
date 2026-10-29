ALTER TABLE public.events ADD COLUMN crew_sms_setup_enabled boolean, ADD COLUMN crew_sms_delivery_enabled boolean;
ALTER TABLE public.event_series ADD COLUMN crew_sms_setup_enabled boolean NOT NULL DEFAULT true, ADD COLUMN crew_sms_delivery_enabled boolean NOT NULL DEFAULT true;
COMMENT ON COLUMN public.events.crew_sms_setup_enabled IS 'NULL inherits series setting, otherwise automatic setup SMS override; LBA never receives automatic SMS.';
COMMENT ON COLUMN public.events.crew_sms_delivery_enabled IS 'NULL inherits series setting, otherwise automatic delivery SMS override; LBA never receives automatic SMS.';
CREATE OR REPLACE FUNCTION public.crew_sms_event_enabled(_event_id uuid,_kind text) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public AS $$
 SELECT coalesce(CASE WHEN _kind='setup' THEN coalesce(e.crew_sms_setup_enabled,s.crew_sms_setup_enabled,true) WHEN _kind='delivery' THEN coalesce(e.crew_sms_delivery_enabled,s.crew_sms_delivery_enabled,true) ELSE false END,false)
 AND NOT (coalesce(e.event_name,'') ~* '\mLBA\M' OR coalesce(t.name,'') ~* '\mLBA\M' OR coalesce(s.name,'') ~* '\mLBA\M' OR coalesce(st.name,'') ~* '\mLBA\M')
 FROM public.events e LEFT JOIN public.event_series s ON s.id=e.event_series_id LEFT JOIN public.event_types t ON t.id=e.event_type_id LEFT JOIN public.event_types st ON st.id=s.event_type_id WHERE e.id=_event_id;
$$;
REVOKE ALL ON FUNCTION public.crew_sms_event_enabled(uuid,text) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.crew_sms_event_enabled(uuid,text) TO service_role;
DO $$ DECLARE definition text; BEGIN
 SELECT pg_get_functiondef('public.crew_sms_schedule(timestamptz,timestamptz)'::regprocedure) INTO definition;
 IF position('WHERE c.mobile IS NOT NULL' IN definition)=0 THEN RAISE EXCEPTION 'Expected schedule filter not found'; END IF;
 definition := replace(definition,'WHERE c.mobile IS NOT NULL','WHERE public.crew_sms_event_enabled(c.eid,c.kind) AND c.mobile IS NOT NULL');
 EXECUTE definition;
END $$;
REVOKE ALL ON FUNCTION public.crew_sms_schedule(timestamptz,timestamptz) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.crew_sms_schedule(timestamptz,timestamptz) TO service_role;