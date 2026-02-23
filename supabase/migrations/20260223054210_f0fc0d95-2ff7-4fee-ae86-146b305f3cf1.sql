-- Remove default that references the enum, change type, then set new default
ALTER TABLE public.leads ALTER COLUMN status DROP DEFAULT;
ALTER TABLE public.leads ALTER COLUMN status TYPE text USING status::text;
ALTER TABLE public.leads ALTER COLUMN status SET DEFAULT 'new';

-- Drop the old enum type
DROP TYPE IF EXISTS public.lead_status;