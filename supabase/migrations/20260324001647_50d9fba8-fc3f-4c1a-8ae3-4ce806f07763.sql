
-- Global pay rate card: one row per staff role
CREATE TABLE public.pay_rate_card (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  staff_role_id UUID REFERENCES public.staff_roles(id) ON DELETE CASCADE NOT NULL,
  hourly_rate NUMERIC(10,2) NOT NULL DEFAULT 0,
  minimum_paid_hours NUMERIC(4,1) NOT NULL DEFAULT 3,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(staff_role_id)
);

-- Series-level fixed rate overrides (e.g. LBA)
CREATE TABLE public.series_fixed_rates (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  series_id UUID REFERENCES public.event_series(id) ON DELETE CASCADE NOT NULL,
  staff_role_id UUID REFERENCES public.staff_roles(id) ON DELETE CASCADE NOT NULL,
  fixed_rate NUMERIC(10,2) NOT NULL DEFAULT 0,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(series_id, staff_role_id)
);

-- RLS
ALTER TABLE public.pay_rate_card ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.series_fixed_rates ENABLE ROW LEVEL SECURITY;

-- Admins can do everything
CREATE POLICY "Admins full access pay_rate_card"
  ON public.pay_rate_card FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins full access series_fixed_rates"
  ON public.series_fixed_rates FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- Crew can read the rate card (to see their pay)
CREATE POLICY "Authenticated read pay_rate_card"
  ON public.pay_rate_card FOR SELECT TO authenticated
  USING (true);

-- Operations can read series rates
CREATE POLICY "Authenticated read series_fixed_rates"
  ON public.series_fixed_rates FOR SELECT TO authenticated
  USING (true);
