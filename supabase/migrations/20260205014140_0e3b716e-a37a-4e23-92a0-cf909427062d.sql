-- Add default workflow step configuration to event_series
ALTER TABLE public.event_series 
ADD COLUMN default_workflow_step_ids UUID[] DEFAULT NULL;

-- Add comment
COMMENT ON COLUMN public.event_series.default_workflow_step_ids IS 'Array of workflow_master_steps IDs to initialize for events in this series';