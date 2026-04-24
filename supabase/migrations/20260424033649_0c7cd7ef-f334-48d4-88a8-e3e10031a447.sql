ALTER TABLE public.client_brief_templates
  ADD COLUMN IF NOT EXISTS pdf_file_name text,
  ADD COLUMN IF NOT EXISTS pdf_file_path text;

INSERT INTO storage.buckets (id, name, public)
VALUES ('client-brief-template-files', 'client-brief-template-files', false)
ON CONFLICT (id) DO NOTHING;

DO $$ BEGIN
  CREATE POLICY "Authenticated can read client brief template files"
    ON storage.objects FOR SELECT TO authenticated
    USING (bucket_id = 'client-brief-template-files');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY "Authenticated can upload client brief template files"
    ON storage.objects FOR INSERT TO authenticated
    WITH CHECK (bucket_id = 'client-brief-template-files');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY "Authenticated can update client brief template files"
    ON storage.objects FOR UPDATE TO authenticated
    USING (bucket_id = 'client-brief-template-files');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY "Authenticated can delete client brief template files"
    ON storage.objects FOR DELETE TO authenticated
    USING (bucket_id = 'client-brief-template-files');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;