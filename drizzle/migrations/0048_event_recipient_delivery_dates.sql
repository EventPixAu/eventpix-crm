ALTER TABLE public.events ADD COLUMN IF NOT EXISTS delivery_deadline_photographer date, ADD COLUMN IF NOT EXISTS delivery_deadline_guests date;
COMMENT ON COLUMN public.events.delivery_deadline_photographer IS 'Date photographer source files are required; separate from the client delivery deadline and post-production session scheduling.';
COMMENT ON COLUMN public.events.delivery_deadline_guests IS 'Date guest photos/gallery are due.';
COMMENT ON COLUMN public.events.delivery_deadline IS 'Date final client photos/gallery are due; retained for existing client delivery warnings and workflows.';