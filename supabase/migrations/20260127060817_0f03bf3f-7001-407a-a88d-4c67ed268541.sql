-- Add sort_order column to workflow_templates for ordering within each phase
ALTER TABLE public.workflow_templates
ADD COLUMN sort_order integer DEFAULT 0;

-- Initialize sort_order based on existing template names (alphabetically) within each phase
WITH ordered AS (
  SELECT id, ROW_NUMBER() OVER (PARTITION BY phase ORDER BY template_name) as rn
  FROM public.workflow_templates
)
UPDATE public.workflow_templates wt
SET sort_order = o.rn
FROM ordered o
WHERE wt.id = o.id;