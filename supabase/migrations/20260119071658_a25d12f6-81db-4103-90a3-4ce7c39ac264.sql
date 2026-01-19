-- Drop the restrictive category check constraint to allow any category from lookup table
ALTER TABLE equipment_items DROP CONSTRAINT IF EXISTS equipment_items_category_check;

-- Update existing items to use lowercase category names for consistency
UPDATE equipment_items SET category = LOWER(category);