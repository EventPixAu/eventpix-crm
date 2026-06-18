
CREATE TABLE public.quote_files (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  quote_id UUID NOT NULL REFERENCES public.quotes(id) ON DELETE CASCADE,
  file_name TEXT NOT NULL,
  file_path TEXT NOT NULL,
  file_size BIGINT,
  mime_type TEXT,
  uploaded_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.quote_files TO authenticated;
GRANT ALL ON public.quote_files TO service_role;

ALTER TABLE public.quote_files ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view quote files" ON public.quote_files
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "Authenticated users can insert quote files" ON public.quote_files
  FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY "Authenticated users can delete quote files" ON public.quote_files
  FOR DELETE TO authenticated USING (true);

CREATE INDEX idx_quote_files_quote_id ON public.quote_files(quote_id);

CREATE POLICY "Authenticated users can upload quote files" ON storage.objects
  FOR INSERT TO authenticated WITH CHECK (bucket_id = 'quote-files');

CREATE POLICY "Authenticated users can read quote files" ON storage.objects
  FOR SELECT TO authenticated USING (bucket_id = 'quote-files');

CREATE POLICY "Authenticated users can delete quote files" ON storage.objects
  FOR DELETE TO authenticated USING (bucket_id = 'quote-files');
