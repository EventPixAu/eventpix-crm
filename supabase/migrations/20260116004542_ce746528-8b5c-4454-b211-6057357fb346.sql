-- Add additional defaults to event_series for Program Control Centre
ALTER TABLE public.event_series
ADD COLUMN IF NOT EXISTS default_venue_city TEXT,
ADD COLUMN IF NOT EXISTS default_notes_public TEXT,
ADD COLUMN IF NOT EXISTS default_notes_internal TEXT;

-- Add index on events.event_series_id for performance (if not exists)
CREATE INDEX IF NOT EXISTS idx_events_series_id ON public.events(event_series_id);

-- Add composite indexes for series queries
CREATE INDEX IF NOT EXISTS idx_events_series_date ON public.events(event_series_id, event_date);

-- Add comment for admin-only internal notes
COMMENT ON COLUMN public.event_series.default_notes_internal IS 'Admin-only notes, not visible to photographers';