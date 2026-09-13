-- Add call time to series (default) and events
ALTER TABLE public.event_series ADD COLUMN IF NOT EXISTS default_call_time time without time zone;
ALTER TABLE public.events ADD COLUMN IF NOT EXISTS call_time time without time zone;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.event_series TO authenticated;
GRANT ALL ON public.event_series TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.events TO authenticated;
GRANT ALL ON public.events TO service_role;