
-- Create the sync trigger and function, then run sync
CREATE OR REPLACE FUNCTION public.sync_staff_user_to_assignments()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- When staff record gets linked to a user account, update any assignments
  IF NEW.user_id IS NOT NULL AND (OLD.user_id IS NULL OR OLD.user_id IS DISTINCT FROM NEW.user_id) THEN
    UPDATE event_assignments
    SET user_id = NEW.user_id
    WHERE staff_id = NEW.id
      AND (user_id IS NULL OR user_id IS DISTINCT FROM NEW.user_id);
  END IF;
  
  RETURN NEW;
END;
$$;

-- Create trigger to auto-sync when staff.user_id changes
DROP TRIGGER IF EXISTS trg_sync_staff_user_to_assignments ON staff;
CREATE TRIGGER trg_sync_staff_user_to_assignments
  AFTER UPDATE OF user_id ON staff
  FOR EACH ROW
  EXECUTE FUNCTION sync_staff_user_to_assignments();

-- Create admin function to manually sync all assignments
CREATE OR REPLACE FUNCTION public.admin_sync_staff_assignments()
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  updated_count INTEGER;
BEGIN
  UPDATE event_assignments ea
  SET user_id = s.user_id
  FROM staff s
  WHERE ea.staff_id = s.id
    AND s.user_id IS NOT NULL
    AND (ea.user_id IS NULL OR ea.user_id IS DISTINCT FROM s.user_id);
    
  GET DIAGNOSTICS updated_count = ROW_COUNT;
  RETURN updated_count;
END;
$$;
