
-- Add default ops_status and default delivery method for guests to event_series
ALTER TABLE public.event_series 
  ADD COLUMN IF NOT EXISTS default_ops_status text DEFAULT 'confirmed',
  ADD COLUMN IF NOT EXISTS default_delivery_method_guests_id uuid REFERENCES public.delivery_methods_lookup(id);

-- Update the auto_assign trigger to also set ops_status, delivery_method_guests_id, and create a default session
CREATE OR REPLACE FUNCTION public.auto_assign_series_defaults()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.event_series_id IS NOT NULL THEN
    -- Auto-assign default staff
    INSERT INTO event_assignments (event_id, user_id, staff_role_id, assignment_notes, confirmation_status)
    SELECT NEW.id, sda.user_id, sda.staff_role_id, sda.assignment_notes, 'pending'
    FROM series_default_assignments sda
    WHERE sda.series_id = NEW.event_series_id
    ON CONFLICT DO NOTHING;

    -- Apply series defaults for ops_status and guest delivery method
    UPDATE events
    SET 
      ops_status = COALESCE(
        (SELECT es.default_ops_status FROM event_series es WHERE es.id = NEW.event_series_id),
        NEW.ops_status
      ),
      delivery_method_guests_id = COALESCE(
        NEW.delivery_method_guests_id,
        (SELECT es.default_delivery_method_guests_id FROM event_series es WHERE es.id = NEW.event_series_id)
      )
    WHERE id = NEW.id;

    -- Auto-create a session from start/end times if both exist on the series
    INSERT INTO event_sessions (event_id, session_date, start_time, end_time, label, sort_order, timezone)
    SELECT 
      NEW.id,
      NEW.event_date,
      es.default_start_time,
      es.default_end_time,
      'Main',
      0,
      'Australia/Sydney'
    FROM event_series es
    WHERE es.id = NEW.event_series_id
      AND es.default_start_time IS NOT NULL
      AND es.default_end_time IS NOT NULL;
  END IF;
  RETURN NEW;
END;
$$;
