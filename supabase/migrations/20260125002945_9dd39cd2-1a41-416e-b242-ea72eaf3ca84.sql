-- Add new fields to profiles table for staff management
ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS vehicle_registration text,
ADD COLUMN IF NOT EXISTS dietary_requirements text;

-- Add comment for documentation
COMMENT ON COLUMN public.profiles.vehicle_registration IS 'Staff vehicle registration number';
COMMENT ON COLUMN public.profiles.dietary_requirements IS 'Staff dietary requirements or restrictions';