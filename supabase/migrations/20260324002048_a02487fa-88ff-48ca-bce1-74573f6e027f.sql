
-- Allowances & surcharges table for travel, equipment add-ons, etc.
CREATE TABLE public.pay_allowances (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  amount NUMERIC(10,2) NOT NULL DEFAULT 0,
  unit TEXT NOT NULL DEFAULT 'flat' CHECK (unit IN ('flat', 'per_hour')),
  is_active BOOLEAN NOT NULL DEFAULT true,
  sort_order INTEGER NOT NULL DEFAULT 0,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.pay_allowances ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins full access pay_allowances"
  ON public.pay_allowances FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Authenticated read pay_allowances"
  ON public.pay_allowances FOR SELECT TO authenticated
  USING (true);

-- Seed the initial allowances
INSERT INTO public.pay_allowances (name, amount, unit, sort_order, notes) VALUES
  ('Travel Allowance', 60.00, 'per_hour', 1, 'Per hour travel rate'),
  ('Studio Lighting Kit (incl. delivery & setup)', 160.00, 'flat', 2, 'Specialist equipment surcharge');
