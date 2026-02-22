
-- Create lead_statuses lookup table
CREATE TABLE public.lead_statuses (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,
  label TEXT NOT NULL,
  badge_variant TEXT DEFAULT 'secondary',
  sort_order INTEGER NOT NULL DEFAULT 0,
  is_active BOOLEAN NOT NULL DEFAULT true,
  is_system BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.lead_statuses ENABLE ROW LEVEL SECURITY;

-- Everyone can read lead statuses
CREATE POLICY "Anyone can read lead statuses" ON public.lead_statuses
  FOR SELECT USING (true);

-- Only admins can manage lead statuses
CREATE POLICY "Admins can manage lead statuses" ON public.lead_statuses
  FOR ALL USING (public.is_admin());

-- Seed default statuses
INSERT INTO public.lead_statuses (name, label, badge_variant, sort_order, is_system) VALUES
  ('new', 'New Lead', 'default', 1, true),
  ('budget_sent', 'Budget Sent', 'secondary', 2, false),
  ('agreement_sent', 'Agreement Sent', 'outline', 3, false),
  ('won', 'Won', 'default', 4, true),
  ('lost', 'Lost', 'destructive', 5, true);
