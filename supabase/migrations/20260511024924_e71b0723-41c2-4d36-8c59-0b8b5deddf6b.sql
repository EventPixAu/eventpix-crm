CREATE TABLE IF NOT EXISTS public.contact_types_lookup (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  value text NOT NULL UNIQUE,
  name text NOT NULL,
  is_active boolean NOT NULL DEFAULT true,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.contact_types_lookup ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated can view contact types"
  ON public.contact_types_lookup FOR SELECT
  TO authenticated USING (true);

CREATE POLICY "Admins manage contact types"
  ON public.contact_types_lookup FOR ALL
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE TRIGGER update_contact_types_lookup_updated_at
  BEFORE UPDATE ON public.contact_types_lookup
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

INSERT INTO public.contact_types_lookup (value, name, sort_order) VALUES
  ('primary', 'Primary Contact', 1),
  ('onsite', 'On-Site Contact', 2),
  ('social_media', 'Social Media Contact', 3),
  ('other', 'Other', 4)
ON CONFLICT (value) DO NOTHING;