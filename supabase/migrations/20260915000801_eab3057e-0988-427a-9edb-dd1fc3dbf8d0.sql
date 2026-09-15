ALTER TABLE public.event_agency_crew ALTER COLUMN agency DROP NOT NULL;
ALTER TABLE public.event_agency_crew DROP CONSTRAINT IF EXISTS event_agency_crew_agency_check;