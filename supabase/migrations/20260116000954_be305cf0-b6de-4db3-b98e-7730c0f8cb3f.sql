-- =============================================
-- ADMIN LOOKUPS: Add is_active, sort_order, updated_at to lookup tables
-- =============================================

-- 1) Update event_types table
ALTER TABLE public.event_types
ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT true,
ADD COLUMN IF NOT EXISTS sort_order INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT now();

-- 2) Update delivery_methods_lookup table  
ALTER TABLE public.delivery_methods_lookup
ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT true,
ADD COLUMN IF NOT EXISTS sort_order INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT now();

-- 3) Create equipment_categories table
CREATE TABLE IF NOT EXISTS public.equipment_categories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL UNIQUE,
  is_active BOOLEAN DEFAULT true,
  sort_order INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- 4) Add category_id FK to equipment_items (nullable for migration)
ALTER TABLE public.equipment_items
ADD COLUMN IF NOT EXISTS category_id UUID REFERENCES public.equipment_categories(id);

-- 5) Seed initial equipment categories from existing text values
INSERT INTO public.equipment_categories (name, is_active, sort_order)
SELECT DISTINCT 
  INITCAP(category) as name,
  true,
  CASE category
    WHEN 'camera' THEN 1
    WHEN 'lens' THEN 2
    WHEN 'flash' THEN 3
    WHEN 'battery' THEN 4
    WHEN 'audio' THEN 5
    WHEN 'video' THEN 6
    WHEN 'tripod' THEN 7
    WHEN 'accessory' THEN 8
    WHEN 'computer' THEN 9
    WHEN 'other' THEN 10
    ELSE 99
  END
FROM public.equipment_items
WHERE category IS NOT NULL
ON CONFLICT (name) DO NOTHING;

-- 6) Migrate existing equipment_items to use category_id
UPDATE public.equipment_items ei
SET category_id = ec.id
FROM public.equipment_categories ec
WHERE LOWER(ec.name) = LOWER(ei.category)
  AND ei.category_id IS NULL;

-- 7) Update sort_order for existing event_types (alphabetical order)
WITH ordered AS (
  SELECT id, ROW_NUMBER() OVER (ORDER BY name) as rn
  FROM public.event_types
)
UPDATE public.event_types et
SET sort_order = o.rn
FROM ordered o
WHERE et.id = o.id;

-- 8) Update sort_order for existing delivery_methods
WITH ordered AS (
  SELECT id, ROW_NUMBER() OVER (ORDER BY name) as rn
  FROM public.delivery_methods_lookup
)
UPDATE public.delivery_methods_lookup dm
SET sort_order = o.rn
FROM ordered o
WHERE dm.id = o.id;

-- =============================================
-- RLS POLICIES
-- =============================================

-- Enable RLS on equipment_categories
ALTER TABLE public.equipment_categories ENABLE ROW LEVEL SECURITY;

-- Equipment Categories: Admin full access, authenticated read
CREATE POLICY "Admin can manage equipment categories" ON public.equipment_categories
  FOR ALL USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Authenticated can read equipment categories" ON public.equipment_categories
  FOR SELECT USING (auth.uid() IS NOT NULL);

-- Event Types: Admin can manage, authenticated can read (already has RLS)
DO $$
BEGIN
  -- Drop existing policies if they exist and recreate
  DROP POLICY IF EXISTS "Admin can manage event types" ON public.event_types;
  DROP POLICY IF EXISTS "Authenticated can read event types" ON public.event_types;
EXCEPTION WHEN undefined_object THEN
  NULL;
END $$;

CREATE POLICY "Admin can manage event types" ON public.event_types
  FOR ALL USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Authenticated can read event types" ON public.event_types
  FOR SELECT USING (auth.uid() IS NOT NULL);

-- Delivery Methods: Admin can manage, authenticated can read
DO $$
BEGIN
  DROP POLICY IF EXISTS "Admin can manage delivery methods" ON public.delivery_methods_lookup;
  DROP POLICY IF EXISTS "Authenticated can read delivery methods" ON public.delivery_methods_lookup;
EXCEPTION WHEN undefined_object THEN
  NULL;
END $$;

CREATE POLICY "Admin can manage delivery methods" ON public.delivery_methods_lookup
  FOR ALL USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Authenticated can read delivery methods" ON public.delivery_methods_lookup
  FOR SELECT USING (auth.uid() IS NOT NULL);