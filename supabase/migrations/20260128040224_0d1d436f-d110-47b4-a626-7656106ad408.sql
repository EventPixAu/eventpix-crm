-- Create site_settings table for configurable business details
CREATE TABLE public.site_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  key TEXT UNIQUE NOT NULL,
  value TEXT,
  description TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.site_settings ENABLE ROW LEVEL SECURITY;

-- Admin-only policies
CREATE POLICY "Admins can manage site settings"
ON public.site_settings
FOR ALL
USING (public.is_admin())
WITH CHECK (public.is_admin());

-- All authenticated users can read settings (needed for Proposal view)
CREATE POLICY "Authenticated users can read site settings"
ON public.site_settings
FOR SELECT
TO authenticated
USING (true);

-- Insert default business settings
INSERT INTO public.site_settings (key, value, description) VALUES
  ('business_name', 'Eventpix Photography', 'Company name shown on proposals'),
  ('business_abn', 'XX XXX XXX XXX', 'Australian Business Number'),
  ('business_email', 'hello@eventpix.com.au', 'Contact email address'),
  ('default_terms', 'A 30% deposit is required to secure your booking.
Balance is due 7 days before the event date.
Photos will be delivered within 14 business days.
This quote is valid for 30 days from the date of issue.', 'Default terms and conditions for proposals');

-- Updated at trigger
CREATE TRIGGER update_site_settings_updated_at
  BEFORE UPDATE ON public.site_settings
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();