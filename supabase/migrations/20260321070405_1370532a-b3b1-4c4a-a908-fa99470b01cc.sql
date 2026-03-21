
-- Trigger function: auto-assign series default staff to new events
CREATE OR REPLACE FUNCTION public.auto_assign_series_defaults()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  -- Only run when event_series_id is set on insert
  IF NEW.event_series_id IS NOT NULL THEN
    INSERT INTO event_assignments (event_id, user_id, staff_role_id, assignment_notes, confirmation_status)
    SELECT 
      NEW.id,
      sda.user_id,
      sda.staff_role_id,
      sda.assignment_notes,
      'pending'
    FROM series_default_assignments sda
    WHERE sda.series_id = NEW.event_series_id;
  END IF;
  
  RETURN NEW;
END;
$$;

-- Create trigger on events table
DROP TRIGGER IF EXISTS trg_auto_assign_series_defaults ON events;
CREATE TRIGGER trg_auto_assign_series_defaults
  AFTER INSERT ON events
  FOR EACH ROW
  EXECUTE FUNCTION public.auto_assign_series_defaults();
