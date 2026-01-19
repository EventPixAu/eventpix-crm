-- Add missing columns to staff_roles table for admin management
ALTER TABLE public.staff_roles 
  ADD COLUMN IF NOT EXISTS is_active boolean DEFAULT true,
  ADD COLUMN IF NOT EXISTS sort_order integer DEFAULT 0,
  ADD COLUMN IF NOT EXISTS description text;

-- Update existing rows to have proper sort_order
UPDATE public.staff_roles SET sort_order = row_number 
FROM (
  SELECT id, ROW_NUMBER() OVER (ORDER BY created_at) as row_number
  FROM public.staff_roles
) numbered
WHERE public.staff_roles.id = numbered.id;