
CREATE TABLE public.assignment_allowances (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  assignment_id UUID NOT NULL REFERENCES public.event_assignments(id) ON DELETE CASCADE,
  allowance_id UUID NOT NULL REFERENCES public.pay_allowances(id) ON DELETE CASCADE,
  quantity NUMERIC(10,2) NOT NULL DEFAULT 1,
  override_amount NUMERIC(10,2),
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(assignment_id, allowance_id)
);

ALTER TABLE public.assignment_allowances ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins full access assignment_allowances"
  ON public.assignment_allowances FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Authenticated read assignment_allowances"
  ON public.assignment_allowances FOR SELECT TO authenticated
  USING (true);
