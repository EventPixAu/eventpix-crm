-- =========================================================
-- Phase 1.1: Add arrival_time to event_sessions
-- Supports photographer call times distinct from event start
-- =========================================================

-- Add arrival_time column to event_sessions
ALTER TABLE public.event_sessions
ADD COLUMN IF NOT EXISTS arrival_time TIME;

-- Add comment for clarity
COMMENT ON COLUMN public.event_sessions.arrival_time IS 'Photographer/crew arrival time, distinct from event start_time';