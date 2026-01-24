-- Create company categories lookup table
CREATE TABLE public.company_categories (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name text NOT NULL UNIQUE,
  sort_order integer DEFAULT 0,
  is_active boolean DEFAULT true,
  created_at timestamptz DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.company_categories ENABLE ROW LEVEL SECURITY;

-- Policies
CREATE POLICY "Admin can manage company_categories" 
ON public.company_categories FOR ALL 
USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Authenticated can read company_categories" 
ON public.company_categories FOR SELECT 
USING (auth.uid() IS NOT NULL);

-- Insert the predefined categories
INSERT INTO public.company_categories (name, sort_order) VALUES
  ('Association', 1),
  ('Education', 2),
  ('Event Management', 3),
  ('Event Producer', 4),
  ('Event Production', 5),
  ('Financial Services', 6),
  ('Government', 7),
  ('Marketing', 8),
  ('PCO', 9),
  ('Real Estate', 10),
  ('Technology', 11);

-- Add category_id to clients table (repurposing existing industry field conceptually, but adding proper FK)
ALTER TABLE public.clients 
ADD COLUMN IF NOT EXISTS category_id uuid REFERENCES public.company_categories(id);

-- Add company phone and email as dedicated fields (separate from primary_contact fields)
ALTER TABLE public.clients
ADD COLUMN IF NOT EXISTS company_phone text,
ADD COLUMN IF NOT EXISTS company_email text;