-- Add professional fields to staff table for unlinked team members
ALTER TABLE public.staff
ADD COLUMN IF NOT EXISTS business_name text,
ADD COLUMN IF NOT EXISTS abn text,
ADD COLUMN IF NOT EXISTS address_line1 text,
ADD COLUMN IF NOT EXISTS address_line2 text,
ADD COLUMN IF NOT EXISTS address_city text,
ADD COLUMN IF NOT EXISTS address_state text,
ADD COLUMN IF NOT EXISTS address_postcode text,
ADD COLUMN IF NOT EXISTS vehicle_make_model text,
ADD COLUMN IF NOT EXISTS vehicle_registration text,
ADD COLUMN IF NOT EXISTS pli_details text,
ADD COLUMN IF NOT EXISTS pli_expiry date,
ADD COLUMN IF NOT EXISTS photography_equipment text;