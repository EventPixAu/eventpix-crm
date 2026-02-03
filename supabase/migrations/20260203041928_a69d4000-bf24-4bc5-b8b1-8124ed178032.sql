-- Add discount_label column to quotes table
ALTER TABLE public.quotes
ADD COLUMN IF NOT EXISTS discount_label text;