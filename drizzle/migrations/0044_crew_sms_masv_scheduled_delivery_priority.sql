DO $$
DECLARE definition text;
BEGIN
 SELECT pg_get_functiondef('public.crew_sms_candidates()'::regprocedure) INTO definition;
 IF position('WHEN NOT masv AND editing_at IS NOT NULL' in definition)=0 THEN
  RAISE EXCEPTION 'Expected editing delivery timing branch not found';
 END IF;
 EXECUTE replace(definition,'WHEN NOT masv AND editing_at IS NOT NULL','WHEN editing_at IS NOT NULL');
END $$;
COMMENT ON FUNCTION public.crew_sms_candidates() IS 'All delivery reminders, including MASV ASAP, use earliest scheduled post_production start minus 24 hours, never before shoot finish. Without post-production use finish. Shoot-only setup, hourly 65-minute window, original deduplication keys retained.';