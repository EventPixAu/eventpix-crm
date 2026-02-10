
-- Add insurance-specific fields to staff_compliance_documents
ALTER TABLE public.staff_compliance_documents
  ADD COLUMN IF NOT EXISTS policy_number text,
  ADD COLUMN IF NOT EXISTS renewal_due_date date,
  ADD COLUMN IF NOT EXISTS renewal_paid_date date;
