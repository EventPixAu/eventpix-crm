
-- Update the company_status_audit action check constraint to include auto_update
ALTER TABLE company_status_audit DROP CONSTRAINT IF EXISTS company_status_audit_action_check;

ALTER TABLE company_status_audit ADD CONSTRAINT company_status_audit_action_check 
CHECK (action = ANY (ARRAY[
  'status_override_set'::text, 
  'status_override_cleared'::text,
  'auto_update'::text
]));
