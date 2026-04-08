-- Function to return all equipment when an event is closed
CREATE OR REPLACE FUNCTION public.return_event_equipment(p_event_id uuid)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  affected_count integer;
BEGIN
  -- Mark all active allocations as returned
  UPDATE equipment_allocations
  SET status = 'returned', returned_at = now()
  WHERE event_id = p_event_id
    AND status NOT IN ('returned', 'missing')
    AND returned_at IS NULL;
  
  GET DIAGNOSTICS affected_count = ROW_COUNT;

  -- Set equipment items back to available
  UPDATE equipment_items
  SET status = 'available'
  WHERE id IN (
    SELECT equipment_item_id 
    FROM equipment_allocations 
    WHERE event_id = p_event_id
      AND status = 'returned'
  )
  AND status = 'allocated';

  RETURN affected_count;
END;
$$;