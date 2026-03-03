
ALTER TABLE public.events ADD COLUMN IF NOT EXISTS qr_file_path text;
ALTER TABLE public.events ADD COLUMN IF NOT EXISTS qr_file_name text;
