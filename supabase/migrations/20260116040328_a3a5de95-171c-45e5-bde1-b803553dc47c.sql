-- Phase 2.0: Sales Hardening - Allow Sales role to manage products

-- Drop existing restrictive policies on products
DROP POLICY IF EXISTS "Admin can manage products" ON public.products;

-- Create new policies that allow both Admin and Sales to manage products
CREATE POLICY "Admin and Sales can manage products"
  ON public.products
  FOR ALL
  USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'sales'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'sales'::app_role));

-- Drop existing restrictive policies on product_categories  
DROP POLICY IF EXISTS "Admin can manage product categories" ON public.product_categories;

-- Create new policies that allow both Admin and Sales to manage product_categories
CREATE POLICY "Admin and Sales can manage product categories"
  ON public.product_categories
  FOR ALL
  USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'sales'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'sales'::app_role));

-- Ensure lead_sources has required values (Phase 2.1 prep)
INSERT INTO public.lead_sources (name, sort_order, is_active) VALUES
  ('Repeat client', 0, true),
  ('Facebook / Instagram', 1, true),
  ('Search', 2, true),
  ('Partner', 3, true),
  ('Saw us at another event', 4, true),
  ('Sponsored event', 5, true)
ON CONFLICT (name) DO NOTHING;

-- Update existing lead_sources to match required values and ordering
UPDATE public.lead_sources SET sort_order = 7 WHERE name = 'Website';
UPDATE public.lead_sources SET sort_order = 8 WHERE name = 'Social Media';
UPDATE public.lead_sources SET sort_order = 9 WHERE name = 'Email';
UPDATE public.lead_sources SET sort_order = 10 WHERE name = 'Phone';
UPDATE public.lead_sources SET sort_order = 11 WHERE name = 'Event';
UPDATE public.lead_sources SET sort_order = 100 WHERE name = 'Other';

-- Add unique constraint on lead_sources name if not exists
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'lead_sources_name_key'
  ) THEN
    ALTER TABLE public.lead_sources ADD CONSTRAINT lead_sources_name_key UNIQUE (name);
  END IF;
END $$;