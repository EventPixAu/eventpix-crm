-- Add other_items column to equipment_kits for non-inventory items like power leads, cables, etc.
ALTER TABLE public.equipment_kits 
ADD COLUMN other_items text[] DEFAULT '{}';