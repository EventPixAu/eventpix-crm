-- Add workflow phase support to sales_workflow_templates
-- Phases: lead (sales process), production (event execution), post_production (delivery)
ALTER TABLE public.sales_workflow_templates 
ADD COLUMN IF NOT EXISTS phase TEXT DEFAULT 'lead' CHECK (phase IN ('lead', 'production', 'post_production'));

-- Add description field
ALTER TABLE public.sales_workflow_templates 
ADD COLUMN IF NOT EXISTS description TEXT;

-- Create index for phase filtering
CREATE INDEX IF NOT EXISTS idx_sales_workflow_templates_phase 
ON public.sales_workflow_templates(phase);

-- Insert some default templates for each phase if none exist
INSERT INTO public.sales_workflow_templates (name, phase, description, items)
SELECT 'Standard Lead Qualification', 'lead', 'Basic lead qualification workflow', 
  '[{"title": "Initial contact made", "sort_order": 0}, {"title": "Requirements gathered", "sort_order": 1}, {"title": "Quote prepared", "sort_order": 2}, {"title": "Quote sent", "sort_order": 3}, {"title": "Follow-up completed", "sort_order": 4}]'::jsonb
WHERE NOT EXISTS (SELECT 1 FROM public.sales_workflow_templates WHERE phase = 'lead');

INSERT INTO public.sales_workflow_templates (name, phase, description, items)
SELECT 'Standard Event Production', 'production', 'Pre-event and day-of production workflow', 
  '[{"title": "Crew confirmed", "sort_order": 0}, {"title": "Equipment allocated", "sort_order": 1}, {"title": "Run sheet prepared", "sort_order": 2}, {"title": "Client brief reviewed", "sort_order": 3}, {"title": "Venue logistics confirmed", "sort_order": 4}]'::jsonb
WHERE NOT EXISTS (SELECT 1 FROM public.sales_workflow_templates WHERE phase = 'production');

INSERT INTO public.sales_workflow_templates (name, phase, description, items)
SELECT 'Standard Post-Production', 'post_production', 'Post-event delivery workflow', 
  '[{"title": "Files backed up", "sort_order": 0}, {"title": "Editing completed", "sort_order": 1}, {"title": "Gallery prepared", "sort_order": 2}, {"title": "Client approval", "sort_order": 3}, {"title": "Final delivery", "sort_order": 4}]'::jsonb
WHERE NOT EXISTS (SELECT 1 FROM public.sales_workflow_templates WHERE phase = 'post_production');