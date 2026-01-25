-- Add location fields to profiles table for Team member location support
ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS location text,
ADD COLUMN IF NOT EXISTS location_state text,
ADD COLUMN IF NOT EXISTS location_postcode text;

-- Add location field to staff table for legacy compatibility
ALTER TABLE public.staff
ADD COLUMN IF NOT EXISTS location text;