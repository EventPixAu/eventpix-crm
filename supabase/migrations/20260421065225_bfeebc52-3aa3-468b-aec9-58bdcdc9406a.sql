
DROP POLICY IF EXISTS "Authenticated users can view galleries" ON storage.objects;

CREATE POLICY "Authenticated users can view galleries"
ON storage.objects
FOR SELECT
TO authenticated
USING (bucket_id = 'galleries');
