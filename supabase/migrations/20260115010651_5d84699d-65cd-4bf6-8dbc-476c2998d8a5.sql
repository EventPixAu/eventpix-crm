-- Create event_notes table for on-site observations
CREATE TABLE public.event_notes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id uuid NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
  created_by uuid NOT NULL REFERENCES public.profiles(id),
  content text NOT NULL,
  note_type text DEFAULT 'observation',
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.event_notes ENABLE ROW LEVEL SECURITY;

-- Admins can manage all notes
CREATE POLICY "Admins can manage event notes"
  ON public.event_notes
  FOR ALL
  USING (has_role(auth.uid(), 'admin'::app_role));

-- Staff can view notes for assigned events
CREATE POLICY "Staff can view notes for assigned events"
  ON public.event_notes
  FOR SELECT
  USING (is_assigned_to_event(auth.uid(), event_id));

-- Staff can create notes for assigned events
CREATE POLICY "Staff can create notes for assigned events"
  ON public.event_notes
  FOR INSERT
  WITH CHECK (is_assigned_to_event(auth.uid(), event_id) AND auth.uid() = created_by);

-- Index for faster queries
CREATE INDEX idx_event_notes_event_id ON public.event_notes(event_id);
CREATE INDEX idx_event_notes_created_at ON public.event_notes(created_at DESC);