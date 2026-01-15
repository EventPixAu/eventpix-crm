-- Add thumbnail_path column to gallery_assets
ALTER TABLE public.gallery_assets
ADD COLUMN thumbnail_path text;