
-- Update the clients status check constraint to match the company_statuses lookup table
ALTER TABLE clients DROP CONSTRAINT IF EXISTS clients_status_check;

ALTER TABLE clients ADD CONSTRAINT clients_status_check 
CHECK (status IS NULL OR status = ANY (ARRAY[
  'prospect'::text, 
  'active_event'::text, 
  'current_client'::text, 
  'previous_client'::text, 
  'supplier'::text, 
  'active'::text, 
  'inactive'::text, 
  'lost'::text
]));
