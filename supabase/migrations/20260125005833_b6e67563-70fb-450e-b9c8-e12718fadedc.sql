-- Add workflow_domain to workflow_templates (operations templates)
ALTER TABLE public.workflow_templates 
ADD COLUMN IF NOT EXISTS workflow_domain text NOT NULL DEFAULT 'operations'
CHECK (workflow_domain IN ('sales', 'operations'));

-- Add workflow_domain to sales_workflow_templates
ALTER TABLE public.sales_workflow_templates 
ADD COLUMN IF NOT EXISTS workflow_domain text NOT NULL DEFAULT 'sales'
CHECK (workflow_domain IN ('sales', 'operations'));

-- Update existing workflow_templates to be operations (they're all event-related)
UPDATE public.workflow_templates SET workflow_domain = 'operations' WHERE workflow_domain IS NULL OR workflow_domain = '';

-- Update existing sales_workflow_templates to be sales
UPDATE public.sales_workflow_templates SET workflow_domain = 'sales' WHERE workflow_domain IS NULL OR workflow_domain = '';

-- Create index for filtering
CREATE INDEX IF NOT EXISTS idx_workflow_templates_domain ON public.workflow_templates(workflow_domain);
CREATE INDEX IF NOT EXISTS idx_sales_workflow_templates_domain ON public.sales_workflow_templates(workflow_domain);