ALTER TABLE public.event_assignments
ADD COLUMN IF NOT EXISTS responsible_for_delivery boolean NOT NULL DEFAULT false;

CREATE INDEX IF NOT EXISTS idx_event_assignments_responsible_for_delivery
ON public.event_assignments(event_id) WHERE responsible_for_delivery = true;