-- Add session_id to lead_assignments for per-session crew allocation
ALTER TABLE public.lead_assignments 
  ADD COLUMN session_id uuid REFERENCES public.event_sessions(id) ON DELETE SET NULL;

-- Add index for session-based lookups
CREATE INDEX idx_lead_assignments_session_id ON public.lead_assignments(session_id);

-- Also add session_id to event_assignments if not present
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'event_assignments' AND column_name = 'session_id'
  ) THEN
    ALTER TABLE public.event_assignments 
      ADD COLUMN session_id uuid REFERENCES public.event_sessions(id) ON DELETE SET NULL;
    CREATE INDEX idx_event_assignments_session_id ON public.event_assignments(session_id);
  END IF;
END $$;