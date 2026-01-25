-- Migrate photography_equipment from text to JSONB for structured equipment data
-- This supports cameras, lenses, lights, and backdrops as separate arrays

-- Add new JSONB column for structured equipment (profiles table)
ALTER TABLE public.profiles
ADD COLUMN IF NOT EXISTS photography_equipment_json JSONB DEFAULT '{
  "cameras": [],
  "lenses": [],
  "lights": [],
  "backdrops": []
}'::jsonb;

-- Add same column to staff table for legacy records
ALTER TABLE public.staff
ADD COLUMN IF NOT EXISTS photography_equipment_json JSONB DEFAULT '{
  "cameras": [],
  "lenses": [],
  "lights": [],
  "backdrops": []
}'::jsonb;

-- Add comment for documentation
COMMENT ON COLUMN public.profiles.photography_equipment_json IS 'Structured photography equipment: cameras, lenses, lights, backdrops arrays with name/brand/notes per item';
COMMENT ON COLUMN public.staff.photography_equipment_json IS 'Structured photography equipment: cameras, lenses, lights, backdrops arrays with name/brand/notes per item';