-- Add caption and alt_text columns to gallery_assets
ALTER TABLE public.gallery_assets
ADD COLUMN caption text,
ADD COLUMN alt_text text;