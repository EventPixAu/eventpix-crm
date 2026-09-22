ALTER TABLE public.event_series
  ADD COLUMN IF NOT EXISTS series_type text NOT NULL DEFAULT 'multi_venue',
  ADD COLUMN IF NOT EXISTS default_venue_name text,
  ADD COLUMN IF NOT EXISTS default_venue_address text;