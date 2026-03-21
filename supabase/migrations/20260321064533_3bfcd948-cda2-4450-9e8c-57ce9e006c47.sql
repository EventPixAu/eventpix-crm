ALTER TABLE public.event_series 
  ADD COLUMN default_start_time time WITHOUT TIME ZONE,
  ADD COLUMN default_end_time time WITHOUT TIME ZONE;