-- Add calendar_sequence to events table for ICS invite updates
ALTER TABLE public.events ADD COLUMN IF NOT EXISTS calendar_sequence integer NOT NULL DEFAULT 0;

-- Create function to increment calendar_sequence on relevant changes
CREATE OR REPLACE FUNCTION public.increment_calendar_sequence()
RETURNS TRIGGER AS $$
BEGIN
  -- Only increment if relevant fields changed
  IF (OLD.start_at IS DISTINCT FROM NEW.start_at) OR
     (OLD.end_at IS DISTINCT FROM NEW.end_at) OR
     (OLD.start_time IS DISTINCT FROM NEW.start_time) OR
     (OLD.end_time IS DISTINCT FROM NEW.end_time) OR
     (OLD.venue_name IS DISTINCT FROM NEW.venue_name) OR
     (OLD.venue_address IS DISTINCT FROM NEW.venue_address) THEN
    NEW.calendar_sequence := OLD.calendar_sequence + 1;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Create trigger for auto-incrementing calendar_sequence
DROP TRIGGER IF EXISTS increment_event_calendar_sequence ON public.events;
CREATE TRIGGER increment_event_calendar_sequence
  BEFORE UPDATE ON public.events
  FOR EACH ROW
  EXECUTE FUNCTION public.increment_calendar_sequence();

-- Add notified flag to event_assignments to track notification status
ALTER TABLE public.event_assignments ADD COLUMN IF NOT EXISTS notified boolean NOT NULL DEFAULT false;