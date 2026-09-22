ALTER TABLE public.events ADD COLUMN setup_time text;
COMMENT ON COLUMN public.events.setup_time IS 'Crew setup time before start (local time string, e.g. 08:30)';
ALTER TABLE public.event_series ADD COLUMN default_setup_time text;
COMMENT ON COLUMN public.event_series.default_setup_time IS 'Default crew setup time applied to events in the series';