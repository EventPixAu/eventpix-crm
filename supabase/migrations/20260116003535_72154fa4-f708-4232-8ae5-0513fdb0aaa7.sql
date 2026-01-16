-- Add indexes for Day Load View performance
-- Index on event_sessions.session_date for date-based queries
CREATE INDEX IF NOT EXISTS idx_event_sessions_session_date ON public.event_sessions(session_date);

-- Index on event_assignments.event_id for fast joins
CREATE INDEX IF NOT EXISTS idx_event_assignments_event_id ON public.event_assignments(event_id);

-- Index on event_assignments.user_id for conflict detection
CREATE INDEX IF NOT EXISTS idx_event_assignments_user_id ON public.event_assignments(user_id);

-- Index on events.event_date for date filtering
CREATE INDEX IF NOT EXISTS idx_events_event_date ON public.events(event_date);

-- Composite index for delivery deadline queries
CREATE INDEX IF NOT EXISTS idx_events_delivery_deadline ON public.events(delivery_deadline) WHERE delivery_deadline IS NOT NULL;

-- Index for equipment allocations by event
CREATE INDEX IF NOT EXISTS idx_equipment_allocations_event_id ON public.equipment_allocations(event_id);