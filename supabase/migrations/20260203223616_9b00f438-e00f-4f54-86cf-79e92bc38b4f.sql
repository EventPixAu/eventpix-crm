-- Add 'previous_step' as a new date_offset_reference option
-- First, we need to check the existing constraint and update it

-- Drop the existing check constraint if it exists
ALTER TABLE public.workflow_master_steps 
DROP CONSTRAINT IF EXISTS workflow_master_steps_date_offset_reference_check;

-- Add a new check constraint that includes 'previous_step'
ALTER TABLE public.workflow_master_steps
ADD CONSTRAINT workflow_master_steps_date_offset_reference_check 
CHECK (date_offset_reference IN ('lead_created', 'job_accepted', 'event_date', 'delivery_deadline', 'previous_step'));