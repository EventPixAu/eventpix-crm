ALTER TABLE public.equipment_allocations 
ADD COLUMN session_id uuid REFERENCES public.event_sessions(id) ON DELETE SET NULL;