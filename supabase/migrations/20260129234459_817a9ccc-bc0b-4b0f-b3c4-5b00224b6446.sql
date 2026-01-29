-- Add sales_workflow_id column to leads table
ALTER TABLE public.leads 
ADD COLUMN IF NOT EXISTS sales_workflow_id uuid REFERENCES public.sales_workflow_templates(id);

-- Add index for performance
CREATE INDEX IF NOT EXISTS idx_leads_sales_workflow_id ON public.leads(sales_workflow_id);