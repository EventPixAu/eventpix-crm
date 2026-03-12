
-- Create the compliance-documents storage bucket
INSERT INTO storage.buckets (id, name, public)
VALUES ('compliance-documents', 'compliance-documents', true)
ON CONFLICT (id) DO NOTHING;

-- Allow authenticated users to upload to their own folder
CREATE POLICY "Users can upload own compliance docs"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'compliance-documents'
  AND (storage.foldername(name))[1] = auth.uid()::text
);

-- Allow authenticated users to read their own docs
CREATE POLICY "Users can read own compliance docs"
ON storage.objects FOR SELECT
TO authenticated
USING (
  bucket_id = 'compliance-documents'
  AND (storage.foldername(name))[1] = auth.uid()::text
);

-- Allow admins to read all compliance docs
CREATE POLICY "Admins can read all compliance docs"
ON storage.objects FOR SELECT
TO authenticated
USING (
  bucket_id = 'compliance-documents'
  AND public.is_admin()
);

-- Allow users to update their own docs
CREATE POLICY "Users can update own compliance docs"
ON storage.objects FOR UPDATE
TO authenticated
USING (
  bucket_id = 'compliance-documents'
  AND (storage.foldername(name))[1] = auth.uid()::text
);

-- Allow users to delete their own docs
CREATE POLICY "Users can delete own compliance docs"
ON storage.objects FOR DELETE
TO authenticated
USING (
  bucket_id = 'compliance-documents'
  AND (storage.foldername(name))[1] = auth.uid()::text
);
