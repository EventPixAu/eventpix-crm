-- Add new fields to profiles table for comprehensive team member data
ALTER TABLE public.profiles
ADD COLUMN IF NOT EXISTS business_name text,
ADD COLUMN IF NOT EXISTS abn text,
ADD COLUMN IF NOT EXISTS address_line1 text,
ADD COLUMN IF NOT EXISTS address_line2 text,
ADD COLUMN IF NOT EXISTS address_city text,
ADD COLUMN IF NOT EXISTS address_state text,
ADD COLUMN IF NOT EXISTS address_postcode text,
ADD COLUMN IF NOT EXISTS vehicle_make_model text,
ADD COLUMN IF NOT EXISTS pli_details text,
ADD COLUMN IF NOT EXISTS pli_expiry date,
ADD COLUMN IF NOT EXISTS photography_equipment text;

-- Add comment for clarity
COMMENT ON COLUMN public.profiles.business_name IS 'Team member business/trading name';
COMMENT ON COLUMN public.profiles.abn IS 'Australian Business Number';
COMMENT ON COLUMN public.profiles.address_line1 IS 'Primary address line';
COMMENT ON COLUMN public.profiles.address_line2 IS 'Secondary address line (unit, etc)';
COMMENT ON COLUMN public.profiles.address_city IS 'Address city/suburb';
COMMENT ON COLUMN public.profiles.address_state IS 'Address state';
COMMENT ON COLUMN public.profiles.address_postcode IS 'Address postcode';
COMMENT ON COLUMN public.profiles.vehicle_make_model IS 'Vehicle make and model';
COMMENT ON COLUMN public.profiles.pli_details IS 'Professional Liability Insurance details';
COMMENT ON COLUMN public.profiles.pli_expiry IS 'PLI expiry date';
COMMENT ON COLUMN public.profiles.photography_equipment IS 'Photography equipment owned/used';