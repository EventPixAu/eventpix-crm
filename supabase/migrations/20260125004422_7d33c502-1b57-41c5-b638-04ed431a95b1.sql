-- Add Company Status override fields to clients table
-- Allows Admin/Sales to manually set company status with override capability

-- Add status override columns
ALTER TABLE public.clients 
ADD COLUMN IF NOT EXISTS manual_status text CHECK (manual_status IN ('prospect', 'active_event', 'current_client', 'previous_client')),
ADD COLUMN IF NOT EXISTS status_override_at timestamptz,
ADD COLUMN IF NOT EXISTS status_override_by uuid REFERENCES auth.users(id);

-- Add comment for documentation
COMMENT ON COLUMN public.clients.manual_status IS 'Manual status override. NULL means auto-derived from events.';
COMMENT ON COLUMN public.clients.status_override_at IS 'When the manual status was last set.';
COMMENT ON COLUMN public.clients.status_override_by IS 'Who set the manual status override.';