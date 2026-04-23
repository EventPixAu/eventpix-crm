ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS videography_equipment_json jsonb;
ALTER TABLE public.staff ADD COLUMN IF NOT EXISTS videography_equipment_json jsonb;