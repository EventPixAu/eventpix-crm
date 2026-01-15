-- Create storage bucket for event galleries
INSERT INTO storage.buckets (id, name, public)
VALUES ('eventpix-galleries', 'eventpix-galleries', true)
ON CONFLICT (id) DO NOTHING;

-- Storage policies for eventpix-galleries bucket
-- Public can view gallery images (for public gallery page)
CREATE POLICY "Public can view gallery images"
ON storage.objects FOR SELECT
USING (bucket_id = 'eventpix-galleries');

-- Admins can upload gallery images
CREATE POLICY "Admins can upload gallery images"
ON storage.objects FOR INSERT
WITH CHECK (
  bucket_id = 'eventpix-galleries' 
  AND public.has_role(auth.uid(), 'admin')
);

-- Admins can update gallery images
CREATE POLICY "Admins can update gallery images"
ON storage.objects FOR UPDATE
USING (
  bucket_id = 'eventpix-galleries' 
  AND public.has_role(auth.uid(), 'admin')
);

-- Admins can delete gallery images
CREATE POLICY "Admins can delete gallery images"
ON storage.objects FOR DELETE
USING (
  bucket_id = 'eventpix-galleries' 
  AND public.has_role(auth.uid(), 'admin')
);

-- Create gallery_assets table to track uploaded files
CREATE TABLE public.gallery_assets (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  event_id UUID NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
  storage_path TEXT NOT NULL,
  file_name TEXT NOT NULL,
  mime_type TEXT,
  file_size INTEGER,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS on gallery_assets
ALTER TABLE public.gallery_assets ENABLE ROW LEVEL SECURITY;

-- Admins can manage all gallery assets
CREATE POLICY "Admins can manage gallery assets"
ON public.gallery_assets FOR ALL
USING (public.has_role(auth.uid(), 'admin'));

-- Staff can view gallery assets for assigned events
CREATE POLICY "Staff can view assigned gallery assets"
ON public.gallery_assets FOR SELECT
USING (public.is_assigned_to_event(auth.uid(), event_id));

-- Public can view gallery assets (for public gallery page via edge function or anon access)
CREATE POLICY "Public can view gallery assets"
ON public.gallery_assets FOR SELECT
USING (true);