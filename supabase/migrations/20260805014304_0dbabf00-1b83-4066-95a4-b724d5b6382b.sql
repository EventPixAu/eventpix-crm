ALTER TABLE public.events DROP CONSTRAINT IF EXISTS events_ops_status_check;

UPDATE public.ops_statuses SET name = 'cancelled', label = 'Event Cancelled' WHERE name = 'postponed';

UPDATE public.events SET ops_status = 'cancelled' WHERE ops_status = 'postponed';

ALTER TABLE public.events ADD CONSTRAINT events_ops_status_check CHECK (ops_status = ANY (ARRAY['awaiting_details'::text, 'confirmed'::text, 'ready'::text, 'in_progress'::text, 'editing'::text, 'delivered'::text, 'completed'::text, 'archived'::text, 'cancelled'::text]));