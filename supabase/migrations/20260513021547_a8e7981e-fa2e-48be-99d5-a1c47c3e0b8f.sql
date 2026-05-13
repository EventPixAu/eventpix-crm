
CREATE TABLE public.event_equipment_notes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id UUID NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  notes TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (event_id, user_id)
);

ALTER TABLE public.event_equipment_notes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins and ops manage event equipment notes"
ON public.event_equipment_notes
FOR ALL
TO authenticated
USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'operations'))
WITH CHECK (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'operations'));

CREATE POLICY "Users view their own equipment notes"
ON public.event_equipment_notes
FOR SELECT
TO authenticated
USING (user_id = auth.uid());

CREATE TRIGGER trg_event_equipment_notes_updated_at
BEFORE UPDATE ON public.event_equipment_notes
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE INDEX idx_event_equipment_notes_event ON public.event_equipment_notes(event_id);
