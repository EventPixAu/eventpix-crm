-- Add timezone column to event_sessions with Sydney as default
ALTER TABLE public.event_sessions 
ADD COLUMN IF NOT EXISTS timezone text DEFAULT 'Australia/Sydney';

-- Add comment for documentation
COMMENT ON COLUMN public.event_sessions.timezone IS 'IANA timezone identifier for this session (e.g., Australia/Sydney, Australia/Perth, Pacific/Auckland)';

-- Also add timezone to events table for single-session events
ALTER TABLE public.events 
ADD COLUMN IF NOT EXISTS timezone text DEFAULT 'Australia/Sydney';

COMMENT ON COLUMN public.events.timezone IS 'Default IANA timezone for the event';