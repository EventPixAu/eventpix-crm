-- Return equipment for already-completed events that were missed
UPDATE equipment_allocations
SET status = 'returned', returned_at = now()
WHERE status NOT IN ('returned', 'missing')
  AND returned_at IS NULL
  AND event_id IN (
    SELECT id FROM events WHERE ops_status = 'completed'
  );

UPDATE equipment_items
SET status = 'available'
WHERE status = 'allocated'
  AND id NOT IN (
    SELECT equipment_item_id FROM equipment_allocations
    WHERE status NOT IN ('returned', 'missing')
    AND returned_at IS NULL
  );