
-- Add PDF file columns to event_brief_templates
ALTER TABLE public.event_brief_templates
  ADD COLUMN pdf_file_name text,
  ADD COLUMN pdf_file_path text;

-- Create storage bucket for brief template PDFs
INSERT INTO storage.buckets (id, name, public)
VALUES ('brief-template-files', 'brief-template-files', false)
ON CONFLICT (id) DO NOTHING;

-- RLS: authenticated users can upload
CREATE POLICY "Authenticated users can upload brief template files"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'brief-template-files');

-- RLS: authenticated users can read
CREATE POLICY "Authenticated users can read brief template files"
ON storage.objects FOR SELECT TO authenticated
USING (bucket_id = 'brief-template-files');

-- RLS: authenticated users can delete
CREATE POLICY "Authenticated users can delete brief template files"
ON storage.objects FOR DELETE TO authenticated
USING (bucket_id = 'brief-template-files');
