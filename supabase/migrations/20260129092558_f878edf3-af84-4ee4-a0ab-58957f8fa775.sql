-- Create company_statuses lookup table
CREATE TABLE public.company_statuses (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,
  label TEXT NOT NULL,
  badge_variant TEXT DEFAULT 'secondary',
  sort_order INTEGER NOT NULL DEFAULT 0,
  is_active BOOLEAN NOT NULL DEFAULT true,
  is_system BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.company_statuses ENABLE ROW LEVEL SECURITY;

-- Everyone can read
CREATE POLICY "Anyone can read company_statuses"
  ON public.company_statuses FOR SELECT
  USING (true);

-- Only admin can modify
CREATE POLICY "Admin can manage company_statuses"
  ON public.company_statuses FOR ALL
  USING (public.is_admin());

-- Insert default statuses (matching existing hardcoded values)
INSERT INTO public.company_statuses (name, label, badge_variant, sort_order, is_system) VALUES
  ('prospect', 'Prospect', 'secondary', 1, true),
  ('active_event', 'Active Event', 'default', 2, true),
  ('current_client', 'Current Client', 'default', 3, true),
  ('previous_client', 'Previous Client', 'outline', 4, true),
  ('active', 'Active Client', 'default', 5, false),
  ('inactive', 'Inactive', 'outline', 6, false),
  ('lost', 'Lost', 'destructive', 7, false);

-- Add comment
COMMENT ON TABLE public.company_statuses IS 'Lookup table for company/client status values';