-- =============================================================
-- Phase 1.2: Contact Roles Lookup Table
-- Phase 1.3: Lead Sources Lookup Table  
-- Phase 1.4: Staff Profile Additional Fields
-- =============================================================

-- Phase 1.2: Create contact_roles lookup table
CREATE TABLE IF NOT EXISTS public.contact_roles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL UNIQUE,
  is_active boolean DEFAULT true,
  sort_order integer DEFAULT 0,
  created_at timestamp with time zone DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.contact_roles ENABLE ROW LEVEL SECURITY;

-- RLS Policies for contact_roles
CREATE POLICY "Authenticated can read contact_roles"
  ON public.contact_roles FOR SELECT
  USING (auth.uid() IS NOT NULL);

CREATE POLICY "Admin can manage contact_roles"
  ON public.contact_roles FOR ALL
  USING (has_role(auth.uid(), 'admin'::app_role));

-- Seed default contact roles
INSERT INTO public.contact_roles (name, sort_order) VALUES
  ('Main contact', 1),
  ('Event manager', 2),
  ('Social media manager', 3),
  ('Marketing', 4),
  ('Other', 99)
ON CONFLICT (name) DO NOTHING;

-- Phase 1.3: Create lead_sources lookup table
CREATE TABLE IF NOT EXISTS public.lead_sources (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL UNIQUE,
  is_active boolean DEFAULT true,
  sort_order integer DEFAULT 0,
  created_at timestamp with time zone DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.lead_sources ENABLE ROW LEVEL SECURITY;

-- RLS Policies for lead_sources
CREATE POLICY "Authenticated can read lead_sources"
  ON public.lead_sources FOR SELECT
  USING (auth.uid() IS NOT NULL);

CREATE POLICY "Admin can manage lead_sources"
  ON public.lead_sources FOR ALL
  USING (has_role(auth.uid(), 'admin'::app_role));

-- Seed default lead sources
INSERT INTO public.lead_sources (name, sort_order) VALUES
  ('Website', 1),
  ('Referral', 2),
  ('Social Media', 3),
  ('Email', 4),
  ('Phone', 5),
  ('Event', 6),
  ('Other', 99)
ON CONFLICT (name) DO NOTHING;

-- Add lead_source_id to leads table (optional FK)
ALTER TABLE public.leads 
  ADD COLUMN IF NOT EXISTS lead_source_id uuid REFERENCES public.lead_sources(id);

-- Phase 1.4: Add staff fields to profiles
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS vehicle_registration text,
  ADD COLUMN IF NOT EXISTS dietary_requirements text,
  ADD COLUMN IF NOT EXISTS assigned_equipment_notes text;