ALTER TABLE public.events
  ADD COLUMN IF NOT EXISTS workflow_event_type_id uuid REFERENCES public.event_types(id);

CREATE INDEX IF NOT EXISTS idx_events_workflow_event_type_id
  ON public.events (workflow_event_type_id);