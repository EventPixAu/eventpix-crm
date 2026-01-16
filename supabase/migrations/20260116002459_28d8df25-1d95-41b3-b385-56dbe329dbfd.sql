-- Sales Workflow Templates
CREATE TABLE public.sales_workflow_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  items JSONB NOT NULL DEFAULT '[]'::jsonb,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Lead Workflow Items
CREATE TABLE public.lead_workflow_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id UUID NOT NULL REFERENCES public.leads(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  is_done BOOLEAN DEFAULT false,
  sort_order INT DEFAULT 0,
  done_at TIMESTAMPTZ,
  done_by UUID REFERENCES public.profiles(id),
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Create index for lead_workflow_items
CREATE INDEX idx_lead_workflow_items_lead_id ON public.lead_workflow_items(lead_id);

-- Enable RLS
ALTER TABLE public.sales_workflow_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.lead_workflow_items ENABLE ROW LEVEL SECURITY;

-- RLS for sales_workflow_templates
CREATE POLICY "Admin and Sales can read sales_workflow_templates"
  ON public.sales_workflow_templates FOR SELECT
  USING (can_access_sales(auth.uid()));

CREATE POLICY "Admin can manage sales_workflow_templates"
  ON public.sales_workflow_templates FOR ALL
  USING (has_role(auth.uid(), 'admin'))
  WITH CHECK (has_role(auth.uid(), 'admin'));

-- RLS for lead_workflow_items
CREATE POLICY "Admin and Sales can read lead_workflow_items"
  ON public.lead_workflow_items FOR SELECT
  USING (can_access_sales(auth.uid()));

CREATE POLICY "Admin and Sales can create lead_workflow_items"
  ON public.lead_workflow_items FOR INSERT
  WITH CHECK (can_access_sales(auth.uid()));

CREATE POLICY "Admin and Sales can update lead_workflow_items"
  ON public.lead_workflow_items FOR UPDATE
  USING (can_access_sales(auth.uid()));

CREATE POLICY "Admin and Sales can delete lead_workflow_items"
  ON public.lead_workflow_items FOR DELETE
  USING (can_access_sales(auth.uid()));