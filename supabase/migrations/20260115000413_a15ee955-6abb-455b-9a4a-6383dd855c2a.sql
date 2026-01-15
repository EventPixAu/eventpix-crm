-- =============================================
-- LOOKUP TABLES
-- =============================================

-- Event Types lookup
CREATE TABLE IF NOT EXISTS public.event_types (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL UNIQUE,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Staff Roles lookup
CREATE TABLE IF NOT EXISTS public.staff_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL UNIQUE,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Delivery Methods lookup
CREATE TABLE IF NOT EXISTS public.delivery_methods_lookup (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL UNIQUE,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- =============================================
-- SEED LOOKUP TABLES
-- =============================================

INSERT INTO public.event_types (name) VALUES
  ('Wedding'), ('Corporate'), ('Conference'), ('Sports'),
  ('School'), ('Awards'), ('Festival'), ('Private Party')
ON CONFLICT (name) DO NOTHING;

INSERT INTO public.staff_roles (name) VALUES
  ('Lead Photographer'), ('Second Shooter'), ('Videographer'),
  ('Assistant'), ('Editor')
ON CONFLICT (name) DO NOTHING;

INSERT INTO public.delivery_methods_lookup (name) VALUES
  ('Dropbox'), ('Zno Instant'), ('SpotMyPhotos'),
  ('Internal Gallery'), ('MASV')
ON CONFLICT (name) DO NOTHING;

-- =============================================
-- ENHANCE PROFILES TABLE (staff attributes)
-- =============================================

ALTER TABLE public.profiles 
  ADD COLUMN IF NOT EXISTS phone TEXT,
  ADD COLUMN IF NOT EXISTS default_role_id UUID REFERENCES public.staff_roles(id),
  ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'active' CHECK (status IN ('active', 'inactive'));

-- =============================================
-- UPDATE EVENTS TABLE
-- =============================================

-- Add new FK columns
ALTER TABLE public.events 
  ADD COLUMN IF NOT EXISTS event_type_id UUID REFERENCES public.event_types(id),
  ADD COLUMN IF NOT EXISTS delivery_method_id UUID REFERENCES public.delivery_methods_lookup(id);

-- Rename datetime columns for clarity
ALTER TABLE public.events 
  ADD COLUMN IF NOT EXISTS start_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS end_at TIMESTAMPTZ;

-- Migrate existing date/time data to new columns
UPDATE public.events 
SET start_at = (event_date::date + COALESCE(start_time, '00:00:00')::time)::timestamptz
WHERE start_at IS NULL AND event_date IS NOT NULL;

UPDATE public.events 
SET end_at = (event_date::date + end_time::time)::timestamptz
WHERE end_at IS NULL AND event_date IS NOT NULL AND end_time IS NOT NULL;

-- Migrate event_type enum to FK
UPDATE public.events e
SET event_type_id = et.id
FROM public.event_types et
WHERE LOWER(e.event_type::text) = LOWER(et.name)
  AND e.event_type_id IS NULL;

-- Migrate delivery_method enum to FK
UPDATE public.events e
SET delivery_method_id = dm.id
FROM public.delivery_methods_lookup dm
WHERE LOWER(REPLACE(e.delivery_method::text, '_', ' ')) = LOWER(dm.name)
  AND e.delivery_method_id IS NULL;

-- =============================================
-- UPDATE EVENT_ASSIGNMENTS TABLE
-- =============================================

-- Add new columns for profile-based assignments
ALTER TABLE public.event_assignments
  ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
  ADD COLUMN IF NOT EXISTS staff_role_id UUID REFERENCES public.staff_roles(id),
  ADD COLUMN IF NOT EXISTS assignment_notes TEXT;

-- Migrate staff_id to user_id via staff.user_id
UPDATE public.event_assignments ea
SET user_id = s.user_id
FROM public.staff s
WHERE ea.staff_id = s.id
  AND ea.user_id IS NULL
  AND s.user_id IS NOT NULL;

-- Migrate role_on_event to staff_role_id
UPDATE public.event_assignments ea
SET staff_role_id = sr.id
FROM public.staff_roles sr
WHERE LOWER(ea.role_on_event) = LOWER(sr.name)
  AND ea.staff_role_id IS NULL;

-- =============================================
-- UPDATE DELIVERY_RECORDS TABLE
-- =============================================

ALTER TABLE public.delivery_records
  ADD COLUMN IF NOT EXISTS delivery_method_id UUID REFERENCES public.delivery_methods_lookup(id),
  ADD COLUMN IF NOT EXISTS qr_token TEXT UNIQUE,
  ADD COLUMN IF NOT EXISTS qr_enabled BOOLEAN DEFAULT true;

-- Generate QR tokens for existing records
UPDATE public.delivery_records
SET qr_token = encode(gen_random_bytes(24), 'hex')
WHERE qr_token IS NULL;

-- Migrate delivery_method enum to FK
UPDATE public.delivery_records dr
SET delivery_method_id = dm.id
FROM public.delivery_methods_lookup dm
WHERE LOWER(REPLACE(dr.delivery_method::text, '_', ' ')) = LOWER(dm.name)
  AND dr.delivery_method_id IS NULL;

-- =============================================
-- UPDATE WORKSHEETS TABLE
-- =============================================

ALTER TABLE public.worksheets
  ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'not_started' CHECK (status IN ('not_started', 'in_progress', 'complete'));

-- Add unique constraint
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'worksheets_event_template_unique'
  ) THEN
    ALTER TABLE public.worksheets ADD CONSTRAINT worksheets_event_template_unique UNIQUE (event_id, template_id);
  END IF;
END $$;

-- =============================================
-- UPDATE WORKSHEET_ITEMS TABLE
-- =============================================

-- Rename columns for clarity
ALTER TABLE public.worksheet_items
  ADD COLUMN IF NOT EXISTS template_item_id UUID REFERENCES public.workflow_template_items(id),
  ADD COLUMN IF NOT EXISTS is_done BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS done_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS done_by UUID REFERENCES public.profiles(id),
  ADD COLUMN IF NOT EXISTS notes TEXT;

-- Migrate existing status to is_done
UPDATE public.worksheet_items
SET is_done = (status = 'completed'),
    done_at = completed_at,
    done_by = completed_by
WHERE is_done IS NULL OR is_done = false;

-- Add unique constraint
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'worksheet_items_worksheet_template_item_unique'
  ) THEN
    ALTER TABLE public.worksheet_items ADD CONSTRAINT worksheet_items_worksheet_template_item_unique UNIQUE (worksheet_id, template_item_id);
  END IF;
END $$;

-- =============================================
-- UPDATE WORKFLOW_TEMPLATE_ITEMS TABLE
-- =============================================

ALTER TABLE public.workflow_template_items
  ADD COLUMN IF NOT EXISTS help_text TEXT;

-- Rename item_text to label for consistency
ALTER TABLE public.workflow_template_items 
  RENAME COLUMN item_text TO label;

-- =============================================
-- FUNCTION: Auto-generate QR token on delivery_record insert
-- =============================================

CREATE OR REPLACE FUNCTION public.generate_qr_token()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.qr_token IS NULL THEN
    NEW.qr_token := encode(gen_random_bytes(24), 'hex');
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trigger_generate_qr_token ON public.delivery_records;
CREATE TRIGGER trigger_generate_qr_token
  BEFORE INSERT ON public.delivery_records
  FOR EACH ROW
  EXECUTE FUNCTION public.generate_qr_token();

-- =============================================
-- FUNCTION: Auto-create worksheets on event insert
-- =============================================

CREATE OR REPLACE FUNCTION public.create_worksheets_for_event()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  tmpl RECORD;
  ws_id UUID;
  item RECORD;
BEGIN
  -- Create a worksheet for each active template
  FOR tmpl IN SELECT * FROM public.workflow_templates WHERE is_active = true
  LOOP
    INSERT INTO public.worksheets (event_id, template_id, template_name, phase, status)
    VALUES (NEW.id, tmpl.id, tmpl.template_name, tmpl.phase, 'not_started')
    RETURNING id INTO ws_id;
    
    -- Create worksheet items from template items
    FOR item IN SELECT * FROM public.workflow_template_items WHERE template_id = tmpl.id ORDER BY sort_order
    LOOP
      INSERT INTO public.worksheet_items (worksheet_id, template_item_id, item_text, sort_order, is_done)
      VALUES (ws_id, item.id, item.label, item.sort_order, false);
    END LOOP;
  END LOOP;
  
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trigger_create_worksheets ON public.events;
CREATE TRIGGER trigger_create_worksheets
  AFTER INSERT ON public.events
  FOR EACH ROW
  EXECUTE FUNCTION public.create_worksheets_for_event();

-- =============================================
-- FUNCTION: Check if user is assigned to event (updated)
-- =============================================

CREATE OR REPLACE FUNCTION public.is_assigned_to_event(_user_id uuid, _event_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.event_assignments ea
    WHERE ea.event_id = _event_id
      AND ea.user_id = _user_id
  )
$$;

-- =============================================
-- RLS POLICIES - LOOKUP TABLES (public read)
-- =============================================

ALTER TABLE public.event_types ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.staff_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.delivery_methods_lookup ENABLE ROW LEVEL SECURITY;

-- Anyone authenticated can read lookups
CREATE POLICY "Authenticated can read event_types" ON public.event_types
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "Admins can manage event_types" ON public.event_types
  FOR ALL TO authenticated USING (has_role(auth.uid(), 'admin'));

CREATE POLICY "Authenticated can read staff_roles" ON public.staff_roles
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "Admins can manage staff_roles" ON public.staff_roles
  FOR ALL TO authenticated USING (has_role(auth.uid(), 'admin'));

CREATE POLICY "Authenticated can read delivery_methods" ON public.delivery_methods_lookup
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "Admins can manage delivery_methods" ON public.delivery_methods_lookup
  FOR ALL TO authenticated USING (has_role(auth.uid(), 'admin'));

-- =============================================
-- RLS POLICIES - PROFILES (enhanced)
-- =============================================

DROP POLICY IF EXISTS "Users can view all profiles" ON public.profiles;
DROP POLICY IF EXISTS "Users can update own profile" ON public.profiles;

CREATE POLICY "Authenticated can view profiles" ON public.profiles
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "Users can update own profile" ON public.profiles
  FOR UPDATE TO authenticated USING (auth.uid() = id);

CREATE POLICY "Admins can manage all profiles" ON public.profiles
  FOR ALL TO authenticated USING (has_role(auth.uid(), 'admin'));

-- =============================================
-- RLS POLICIES - EVENTS (updated for user_id)
-- =============================================

DROP POLICY IF EXISTS "Admins can manage events" ON public.events;
DROP POLICY IF EXISTS "Photographers can view assigned events" ON public.events;

CREATE POLICY "Admins can manage events" ON public.events
  FOR ALL TO authenticated USING (has_role(auth.uid(), 'admin'));

CREATE POLICY "Staff can view assigned events" ON public.events
  FOR SELECT TO authenticated 
  USING (is_assigned_to_event(auth.uid(), id));

-- =============================================
-- RLS POLICIES - EVENT_ASSIGNMENTS (updated)
-- =============================================

DROP POLICY IF EXISTS "Admins can manage assignments" ON public.event_assignments;
DROP POLICY IF EXISTS "Photographers can view own assignments" ON public.event_assignments;

CREATE POLICY "Admins can manage assignments" ON public.event_assignments
  FOR ALL TO authenticated USING (has_role(auth.uid(), 'admin'));

CREATE POLICY "Staff can view own assignments" ON public.event_assignments
  FOR SELECT TO authenticated 
  USING (user_id = auth.uid());

CREATE POLICY "Staff can view assignments for their events" ON public.event_assignments
  FOR SELECT TO authenticated 
  USING (is_assigned_to_event(auth.uid(), event_id));

-- =============================================
-- RLS POLICIES - WORKSHEETS (updated)
-- =============================================

DROP POLICY IF EXISTS "Admins can manage worksheets" ON public.worksheets;
DROP POLICY IF EXISTS "Photographers can view assigned worksheets" ON public.worksheets;

CREATE POLICY "Admins can manage worksheets" ON public.worksheets
  FOR ALL TO authenticated USING (has_role(auth.uid(), 'admin'));

CREATE POLICY "Staff can view assigned worksheets" ON public.worksheets
  FOR SELECT TO authenticated 
  USING (is_assigned_to_event(auth.uid(), event_id));

-- =============================================
-- RLS POLICIES - WORKSHEET_ITEMS (updated)
-- =============================================

DROP POLICY IF EXISTS "Admins can manage worksheet items" ON public.worksheet_items;
DROP POLICY IF EXISTS "Photographers can view assigned worksheet items" ON public.worksheet_items;
DROP POLICY IF EXISTS "Photographers can update assigned worksheet items" ON public.worksheet_items;

CREATE POLICY "Admins can manage worksheet items" ON public.worksheet_items
  FOR ALL TO authenticated USING (has_role(auth.uid(), 'admin'));

CREATE POLICY "Staff can view assigned worksheet items" ON public.worksheet_items
  FOR SELECT TO authenticated 
  USING (EXISTS (
    SELECT 1 FROM public.worksheets w
    WHERE w.id = worksheet_items.worksheet_id
      AND is_assigned_to_event(auth.uid(), w.event_id)
  ));

CREATE POLICY "Staff can update assigned worksheet items" ON public.worksheet_items
  FOR UPDATE TO authenticated 
  USING (EXISTS (
    SELECT 1 FROM public.worksheets w
    WHERE w.id = worksheet_items.worksheet_id
      AND is_assigned_to_event(auth.uid(), w.event_id)
  ));

-- =============================================
-- RLS POLICIES - DELIVERY_RECORDS (public QR access)
-- =============================================

DROP POLICY IF EXISTS "Admins can manage delivery records" ON public.delivery_records;
DROP POLICY IF EXISTS "Photographers can view assigned delivery records" ON public.delivery_records;

CREATE POLICY "Admins can manage delivery records" ON public.delivery_records
  FOR ALL TO authenticated USING (has_role(auth.uid(), 'admin'));

CREATE POLICY "Staff can view assigned delivery records" ON public.delivery_records
  FOR SELECT TO authenticated 
  USING (is_assigned_to_event(auth.uid(), event_id));

CREATE POLICY "Public can view by qr_token" ON public.delivery_records
  FOR SELECT TO anon
  USING (qr_enabled = true AND qr_token IS NOT NULL);

-- =============================================
-- RLS POLICIES - WORKFLOW_TEMPLATES
-- =============================================

DROP POLICY IF EXISTS "Admins can manage templates" ON public.workflow_templates;
DROP POLICY IF EXISTS "Photographers can view templates" ON public.workflow_templates;

CREATE POLICY "Admins can manage templates" ON public.workflow_templates
  FOR ALL TO authenticated USING (has_role(auth.uid(), 'admin'));

CREATE POLICY "Staff can view templates" ON public.workflow_templates
  FOR SELECT TO authenticated USING (true);

-- =============================================
-- RLS POLICIES - WORKFLOW_TEMPLATE_ITEMS
-- =============================================

DROP POLICY IF EXISTS "Admins can manage template items" ON public.workflow_template_items;
DROP POLICY IF EXISTS "Photographers can view template items" ON public.workflow_template_items;

CREATE POLICY "Admins can manage template items" ON public.workflow_template_items
  FOR ALL TO authenticated USING (has_role(auth.uid(), 'admin'));

CREATE POLICY "Staff can view template items" ON public.workflow_template_items
  FOR SELECT TO authenticated USING (true);