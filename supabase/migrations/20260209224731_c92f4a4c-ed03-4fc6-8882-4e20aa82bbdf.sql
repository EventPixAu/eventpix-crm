ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS gst_registered boolean DEFAULT false;
ALTER TABLE public.staff ADD COLUMN IF NOT EXISTS gst_registered boolean DEFAULT false;