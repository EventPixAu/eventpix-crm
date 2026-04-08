
-- Drop the old unique index that prevents multi-session allocation
DROP INDEX IF EXISTS idx_equipment_allocations_active;

-- Create a new unique index that allows the same item on different sessions
-- For NULL session_id, only one active allocation is allowed per item per event
CREATE UNIQUE INDEX idx_equipment_allocations_active 
ON public.equipment_allocations (equipment_item_id, event_id, COALESCE(session_id, '00000000-0000-0000-0000-000000000000'::uuid))
WHERE (returned_at IS NULL AND status NOT IN ('returned', 'missing'));
