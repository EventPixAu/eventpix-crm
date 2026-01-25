-- Add status_override_reason column to clients table
ALTER TABLE public.clients 
ADD COLUMN IF NOT EXISTS status_override_reason text;

-- Add override_reason column to company_status_audit table
ALTER TABLE public.company_status_audit 
ADD COLUMN IF NOT EXISTS override_reason text;