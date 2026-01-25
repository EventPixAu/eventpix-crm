-- Create locations lookup table
CREATE TABLE public.locations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL UNIQUE,
  is_active boolean DEFAULT true,
  sort_order integer DEFAULT 0,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.locations ENABLE ROW LEVEL SECURITY;

-- Admin can manage locations
CREATE POLICY "Admin can manage locations"
ON public.locations
FOR ALL
USING (has_role(auth.uid(), 'admin'::app_role));

-- Authenticated users can read active locations
CREATE POLICY "Authenticated can read locations"
ON public.locations
FOR SELECT
USING (auth.uid() IS NOT NULL);

-- Seed initial locations
INSERT INTO public.locations (name, sort_order) VALUES
  ('Sydney', 1),
  ('Melbourne', 2),
  ('Adelaide', 3),
  ('Brisbane', 4),
  ('Perth', 5),
  ('Darwin', 6),
  ('Gold Coast', 7),
  ('Alice Springs', 8),
  ('Cairns', 9),
  ('Canberra', 10),
  ('Hobart', 11),
  ('Launceston', 12),
  ('Geelong', 13);