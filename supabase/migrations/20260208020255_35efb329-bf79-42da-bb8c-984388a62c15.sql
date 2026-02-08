-- Add kit_id to equipment_allocations to track which kit an allocation came from
ALTER TABLE public.equipment_allocations ADD COLUMN kit_id uuid REFERENCES public.equipment_kits(id) ON DELETE SET NULL;

-- Create an index for efficient kit-based queries
CREATE INDEX idx_equipment_allocations_kit_id ON public.equipment_allocations(kit_id);

COMMENT ON COLUMN public.equipment_allocations.kit_id IS 'References the equipment kit this allocation was created from (if any)';