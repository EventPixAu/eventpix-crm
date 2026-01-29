-- Add missing columns to sales_workflow_templates
ALTER TABLE public.sales_workflow_templates 
ADD COLUMN IF NOT EXISTS workflow_key TEXT,
ADD COLUMN IF NOT EXISTS sort_order INTEGER DEFAULT 0;

-- Update existing records with workflow keys if needed
UPDATE public.sales_workflow_templates SET workflow_key = 'new_lead' WHERE name ILIKE '%new%lead%' AND workflow_key IS NULL;
UPDATE public.sales_workflow_templates SET workflow_key = 'repeat_client' WHERE name ILIKE '%repeat%' AND workflow_key IS NULL;