
-- Create ops_statuses lookup table
CREATE TABLE public.ops_statuses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL UNIQUE,
  label text NOT NULL,
  sort_order integer NOT NULL DEFAULT 0,
  is_active boolean NOT NULL DEFAULT true,
  is_system boolean NOT NULL DEFAULT false,
  created_at timestamptz DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.ops_statuses ENABLE ROW LEVEL SECURITY;

-- Everyone can read
CREATE POLICY "Anyone can read ops_statuses" ON public.ops_statuses FOR SELECT TO authenticated USING (true);

-- Only admins can manage
CREATE POLICY "Admins can manage ops_statuses" ON public.ops_statuses FOR ALL TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());

-- Seed with current values
INSERT INTO public.ops_statuses (name, label, sort_order, is_system) VALUES
  ('awaiting_details', 'Awaiting Details', 1, true),
  ('confirmed', 'Confirmed', 2, false),
  ('ready', 'Ready', 3, false),
  ('in_progress', 'In Progress', 4, false),
  ('delivered', 'Delivered', 5, false),
  ('completed', 'Completed', 6, false),
  ('archived', 'Archived', 7, false);
