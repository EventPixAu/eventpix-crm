
-- Lead assignments table for assigning staff to leads (pre-event)
CREATE TABLE public.lead_assignments (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  lead_id UUID NOT NULL REFERENCES public.leads(id) ON DELETE CASCADE,
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  staff_role_id UUID REFERENCES public.staff_roles(id) ON DELETE SET NULL,
  role_on_event TEXT,
  assignment_notes TEXT,
  confirmation_status TEXT NOT NULL DEFAULT 'pending',
  confirmed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now(),
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL
);

-- RLS
ALTER TABLE public.lead_assignments ENABLE ROW LEVEL SECURITY;

-- Admin/ops/sales can manage lead assignments
CREATE POLICY "Admin/ops/sales can manage lead assignments"
  ON public.lead_assignments
  FOR ALL
  TO authenticated
  USING (
    public.current_user_role() IN ('admin', 'operations', 'sales')
  )
  WITH CHECK (
    public.current_user_role() IN ('admin', 'operations', 'sales')
  );

-- Crew can view their own assignments
CREATE POLICY "Crew can view own lead assignments"
  ON public.lead_assignments
  FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());
