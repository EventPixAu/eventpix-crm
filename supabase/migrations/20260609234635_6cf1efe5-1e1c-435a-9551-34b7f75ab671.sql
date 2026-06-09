ALTER TABLE public.event_assignments
ADD COLUMN IF NOT EXISTS travel_amount numeric NOT NULL DEFAULT 0;

COMMENT ON COLUMN public.event_assignments.travel_amount IS 'Manual per-assignment travel reimbursement amount in dollars';