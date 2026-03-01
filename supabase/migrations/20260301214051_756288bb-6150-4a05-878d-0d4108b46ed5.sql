
-- Add confirmation_status to event_assignments
ALTER TABLE public.event_assignments
ADD COLUMN IF NOT EXISTS confirmation_status text NOT NULL DEFAULT 'pending';

-- Add confirmed_at timestamp
ALTER TABLE public.event_assignments
ADD COLUMN IF NOT EXISTS confirmed_at timestamptz;

COMMENT ON COLUMN public.event_assignments.confirmation_status IS 'pending | confirmed | declined';
