
ALTER TABLE public.staff_availability
ADD COLUMN IF NOT EXISTS unavailable_from time WITHOUT TIME ZONE DEFAULT NULL,
ADD COLUMN IF NOT EXISTS unavailable_until time WITHOUT TIME ZONE DEFAULT NULL;

COMMENT ON COLUMN public.staff_availability.unavailable_from IS 'Start time of unavailability window (NULL = all day)';
COMMENT ON COLUMN public.staff_availability.unavailable_until IS 'End time of unavailability window (NULL = all day)';
