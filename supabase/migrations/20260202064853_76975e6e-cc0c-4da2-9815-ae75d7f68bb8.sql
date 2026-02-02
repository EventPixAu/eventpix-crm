-- Remove the hardcoded check constraint on manual_status
-- Now that company_statuses are managed dynamically in a lookup table,
-- the old hardcoded constraint prevents new statuses from being used.

ALTER TABLE public.clients
DROP CONSTRAINT IF EXISTS clients_manual_status_check;