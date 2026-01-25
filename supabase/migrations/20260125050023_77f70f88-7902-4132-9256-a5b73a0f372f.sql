-- Add dietary_requirements and certificates columns to staff table
ALTER TABLE public.staff
ADD COLUMN IF NOT EXISTS dietary_requirements text,
ADD COLUMN IF NOT EXISTS certificates text;

-- Add dietary_requirements and certificates columns to profiles table
ALTER TABLE public.profiles
ADD COLUMN IF NOT EXISTS dietary_requirements text,
ADD COLUMN IF NOT EXISTS certificates text;