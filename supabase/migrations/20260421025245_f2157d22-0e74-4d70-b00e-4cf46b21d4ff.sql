DROP POLICY IF EXISTS "Authenticated users can view insurance documents" ON storage.objects;

CREATE POLICY "Admins can view insurance documents"
ON storage.objects FOR SELECT
TO authenticated
USING (bucket_id = 'insurance-documents' AND has_role(auth.uid(), 'admin'::app_role));