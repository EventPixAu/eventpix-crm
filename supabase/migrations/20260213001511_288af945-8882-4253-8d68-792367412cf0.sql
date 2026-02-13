
-- Create lead_files metadata table
CREATE TABLE public.lead_files (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id UUID NOT NULL REFERENCES public.leads(id) ON DELETE CASCADE,
  file_name TEXT NOT NULL,
  file_path TEXT NOT NULL,
  file_size BIGINT,
  mime_type TEXT,
  uploaded_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.lead_files ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view lead files" ON public.lead_files
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "Authenticated users can insert lead files" ON public.lead_files
  FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY "Authenticated users can delete lead files" ON public.lead_files
  FOR DELETE TO authenticated USING (true);

-- Create storage bucket for lead files
INSERT INTO storage.buckets (id, name, public) VALUES ('lead-files', 'lead-files', true);

CREATE POLICY "Authenticated users can upload lead files" ON storage.objects
  FOR INSERT TO authenticated WITH CHECK (bucket_id = 'lead-files');

CREATE POLICY "Anyone can view lead files" ON storage.objects
  FOR SELECT USING (bucket_id = 'lead-files');

CREATE POLICY "Authenticated users can delete lead files" ON storage.objects
  FOR DELETE TO authenticated USING (bucket_id = 'lead-files');
