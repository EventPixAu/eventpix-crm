
ALTER TABLE public.event_sessions ADD COLUMN IF NOT EXISTS session_type text NOT NULL DEFAULT 'live';
COMMENT ON COLUMN public.event_sessions.session_type IS 'Type of session: live (on-site during event) or post_production (editing/processing on a different day)';
