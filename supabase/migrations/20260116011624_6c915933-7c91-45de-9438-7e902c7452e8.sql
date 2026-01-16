-- Add indexes for performance on readiness gate queries
-- Index on event_sessions.session_date for pre-event readiness (T-24h)
CREATE INDEX IF NOT EXISTS idx_event_sessions_session_date 
ON public.event_sessions (session_date);

-- Index on events.delivery_deadline for pre-delivery readiness (T-24h)
CREATE INDEX IF NOT EXISTS idx_events_delivery_deadline 
ON public.events (delivery_deadline);

-- Composite index for efficient event readiness queries
CREATE INDEX IF NOT EXISTS idx_events_date_status
ON public.events (event_date, ops_status);

-- Index on delivery_records.event_id for joining
CREATE INDEX IF NOT EXISTS idx_delivery_records_event_id
ON public.delivery_records (event_id);