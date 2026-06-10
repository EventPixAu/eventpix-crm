
CREATE TABLE IF NOT EXISTS public.fixed_rate_card (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  staff_role_id uuid NOT NULL REFERENCES public.staff_roles(id) ON DELETE CASCADE UNIQUE,
  fixed_rate numeric NOT NULL DEFAULT 0,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.fixed_rate_card TO authenticated;
GRANT ALL ON public.fixed_rate_card TO service_role;
ALTER TABLE public.fixed_rate_card ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated can read fixed rate card"
  ON public.fixed_rate_card FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admins manage fixed rate card"
  ON public.fixed_rate_card FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE TRIGGER update_fixed_rate_card_updated_at
  BEFORE UPDATE ON public.fixed_rate_card
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
