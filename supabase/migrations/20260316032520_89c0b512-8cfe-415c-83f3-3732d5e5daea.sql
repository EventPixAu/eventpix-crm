
-- Table to store which event page sections are visible per role
CREATE TABLE public.role_section_visibility (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  role TEXT NOT NULL,
  section_key TEXT NOT NULL,
  is_visible BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(role, section_key)
);

-- Enable RLS
ALTER TABLE public.role_section_visibility ENABLE ROW LEVEL SECURITY;

-- Admin can read/write
CREATE POLICY "Admins can manage visibility config"
  ON public.role_section_visibility
  FOR ALL
  TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

-- All authenticated users can read (needed to apply visibility rules)
CREATE POLICY "Authenticated users can read visibility config"
  ON public.role_section_visibility
  FOR SELECT
  TO authenticated
  USING (true);

-- Seed default visibility for operations role (all visible by default)
INSERT INTO public.role_section_visibility (role, section_key, is_visible) VALUES
  ('operations', 'event_details', true),
  ('operations', 'sessions', true),
  ('operations', 'contacts', true),
  ('operations', 'additional_details', true),
  ('operations', 'qr_panel', true),
  ('operations', 'team_brief', true),
  ('operations', 'client_brief', true),
  ('operations', 'status', true),
  ('operations', 'mail_history', true),
  ('operations', 'financials', true),
  ('operations', 'budget', true),
  ('operations', 'documents', true),
  ('operations', 'contracts', true),
  ('operations', 'quotes', true),
  ('operations', 'quick_actions', true),
  ('operations', 'workflow', true),
  ('operations', 'editing_instructions', true),
  ('operations', 'tasks', true),
  ('operations', 'equipment_tab', true),
  ('operations', 'activity_tab', true);
