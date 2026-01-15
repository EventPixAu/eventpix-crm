-- Add sort_order column to gallery_assets for drag-and-drop reordering
ALTER TABLE public.gallery_assets 
ADD COLUMN sort_order integer NOT NULL DEFAULT 0;

-- Create index for efficient ordering
CREATE INDEX idx_gallery_assets_sort_order ON public.gallery_assets(event_id, sort_order);

-- Initialize sort_order based on created_at for existing records
UPDATE public.gallery_assets 
SET sort_order = subq.row_num
FROM (
  SELECT id, ROW_NUMBER() OVER (PARTITION BY event_id ORDER BY created_at) as row_num
  FROM public.gallery_assets
) subq
WHERE public.gallery_assets.id = subq.id;