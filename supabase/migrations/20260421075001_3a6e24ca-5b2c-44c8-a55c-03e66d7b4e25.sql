-- Restrict avatar listing: public URLs still work for direct file access (bucket is public),
-- but listing all files via storage.objects SELECT is restricted to owners + admins.
DROP POLICY IF EXISTS "Authenticated users can view avatars" ON storage.objects;

CREATE POLICY "Users can list own avatar"
ON storage.objects
FOR SELECT
TO authenticated
USING (
  bucket_id = 'avatars'
  AND (storage.foldername(name))[1] = (auth.uid())::text
);