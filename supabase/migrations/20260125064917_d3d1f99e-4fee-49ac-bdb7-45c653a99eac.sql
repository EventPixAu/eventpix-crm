-- Add owner_user_id to equipment_items to track photographer-owned gear
ALTER TABLE public.equipment_items 
ADD COLUMN owner_user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL;

-- Add index for efficient lookups by owner
CREATE INDEX idx_equipment_items_owner ON public.equipment_items(owner_user_id);

-- Add comment for clarity
COMMENT ON COLUMN public.equipment_items.owner_user_id IS 'NULL = EventPix company equipment, UUID = photographer-owned gear';