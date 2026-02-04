-- Drop the existing check constraint
ALTER TABLE public.events DROP CONSTRAINT IF EXISTS events_ops_status_check;

-- Add new check constraint with updated values (added 'confirmed', changed 'closed' to 'completed')
ALTER TABLE public.events ADD CONSTRAINT events_ops_status_check 
  CHECK (ops_status IN ('awaiting_details', 'confirmed', 'ready', 'in_progress', 'delivered', 'completed'));

-- Update any existing 'closed' values to 'completed'
UPDATE public.events SET ops_status = 'completed' WHERE ops_status = 'closed';