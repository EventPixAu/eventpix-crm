ALTER TABLE public.events ADD COLUMN IF NOT EXISTS proposed_services TEXT;
ALTER TABLE public.quotes ADD COLUMN IF NOT EXISTS proposed_services TEXT;
COMMENT ON COLUMN public.events.proposed_services IS 'HTML description of proposed services for this event (Scope of Services). Used as default for quotes and contracts.';
COMMENT ON COLUMN public.quotes.proposed_services IS 'HTML description of proposed services for this quote. Overrides the event-level proposed_services when set.';