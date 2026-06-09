CREATE TABLE public.dress_codes (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,
  is_active BOOLEAN NOT NULL DEFAULT true,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT ON public.dress_codes TO anon, authenticated;
GRANT INSERT, UPDATE, DELETE ON public.dress_codes TO authenticated;
GRANT ALL ON public.dress_codes TO service_role;

ALTER TABLE public.dress_codes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view dress codes"
  ON public.dress_codes FOR SELECT
  USING (true);

CREATE POLICY "Admins can manage dress codes"
  ON public.dress_codes FOR ALL
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE TRIGGER update_dress_codes_updated_at
  BEFORE UPDATE ON public.dress_codes
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

INSERT INTO public.dress_codes (name, sort_order) VALUES
  ('EventPix Black', 1),
  ('Corporate Black', 2),
  ('Cocktail Black', 3),
  ('Outdoor Casual', 4),
  ('Indoor Casual', 5),
  ('Santa Casual', 6);
