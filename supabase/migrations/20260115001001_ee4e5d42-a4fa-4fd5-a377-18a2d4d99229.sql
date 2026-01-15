-- Make staff_id nullable since we're transitioning to user_id-based assignments
ALTER TABLE public.event_assignments ALTER COLUMN staff_id DROP NOT NULL;