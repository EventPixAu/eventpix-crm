-- Create company status audit table
CREATE TABLE IF NOT EXISTS public.company_status_audit (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  action text NOT NULL CHECK (action IN ('status_override_set', 'status_override_cleared')),
  old_status text,
  new_status text,
  changed_by uuid REFERENCES auth.users(id),
  changed_at timestamptz NOT NULL DEFAULT now()
);

-- Add index for efficient querying
CREATE INDEX IF NOT EXISTS idx_company_status_audit_company_id ON public.company_status_audit(company_id);
CREATE INDEX IF NOT EXISTS idx_company_status_audit_changed_at ON public.company_status_audit(changed_at DESC);

-- Enable RLS
ALTER TABLE public.company_status_audit ENABLE ROW LEVEL SECURITY;

-- RLS policies
CREATE POLICY "Admin can manage company_status_audit"
ON public.company_status_audit
FOR ALL
USING (public.has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Sales can view and insert company_status_audit"
ON public.company_status_audit
FOR SELECT
USING (public.can_access_sales(auth.uid()));

CREATE POLICY "Sales can insert company_status_audit"
ON public.company_status_audit
FOR INSERT
WITH CHECK (public.can_access_sales(auth.uid()));