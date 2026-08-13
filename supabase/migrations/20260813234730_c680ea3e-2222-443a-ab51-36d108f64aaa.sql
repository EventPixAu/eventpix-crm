CREATE TABLE public.venue_types (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL UNIQUE,
  is_active boolean NOT NULL DEFAULT true,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.venue_types TO authenticated;
GRANT ALL ON public.venue_types TO service_role;

ALTER TABLE public.venue_types ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated can view venue types"
  ON public.venue_types FOR SELECT TO authenticated USING (true);

CREATE POLICY "Admins manage venue types"
  ON public.venue_types FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE TRIGGER update_venue_types_updated_at
  BEFORE UPDATE ON public.venue_types
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

INSERT INTO public.venue_types (name, sort_order) VALUES
  ('Hotel', 1), ('Club', 2), ('Convention Centre', 3), ('Function Centre', 4),
  ('Stadium', 5), ('Outdoor', 6), ('Other', 7);