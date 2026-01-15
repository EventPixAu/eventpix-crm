-- Add guardrail_override to audit_action enum
ALTER TYPE public.audit_action ADD VALUE IF NOT EXISTS 'guardrail_override';

-- Create guardrail_settings table for configurable thresholds
CREATE TABLE public.guardrail_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  setting_key TEXT NOT NULL UNIQUE,
  setting_value JSONB NOT NULL,
  description TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.guardrail_settings ENABLE ROW LEVEL SECURITY;

-- Only admins can read/write guardrail settings
CREATE POLICY "Admins can manage guardrail settings"
  ON public.guardrail_settings
  FOR ALL
  USING (public.has_role(auth.uid(), 'admin'));

-- Insert default settings
INSERT INTO public.guardrail_settings (setting_key, setting_value, description) VALUES
  ('event_lock_minutes', '60', 'Minutes before event start when editing is locked'),
  ('tight_changeover_minutes', '45', 'Minimum minutes between events to avoid warning'),
  ('max_events_per_day_warning', '2', 'Number of events per day before warning'),
  ('delivery_deadline_warning_hours', '24', 'Hours before deadline to show warning if no link');

-- Create guardrail_overrides table to track all overrides
CREATE TABLE public.guardrail_overrides (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id UUID REFERENCES public.events(id) ON DELETE CASCADE,
  user_id UUID REFERENCES public.profiles(id),
  override_type TEXT NOT NULL,
  rules_breached TEXT[] NOT NULL,
  justification TEXT NOT NULL,
  created_by UUID NOT NULL REFERENCES public.profiles(id),
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.guardrail_overrides ENABLE ROW LEVEL SECURITY;

-- Admins can manage overrides
CREATE POLICY "Admins can manage guardrail overrides"
  ON public.guardrail_overrides
  FOR ALL
  USING (public.has_role(auth.uid(), 'admin'));

-- Create index for faster lookups
CREATE INDEX idx_guardrail_overrides_event ON public.guardrail_overrides(event_id);
CREATE INDEX idx_guardrail_overrides_user ON public.guardrail_overrides(user_id);

-- Add trigger for updated_at on guardrail_settings
CREATE TRIGGER update_guardrail_settings_updated_at
  BEFORE UPDATE ON public.guardrail_settings
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();