
-- Fix 1: Explicit SELECT policy on guardrail_settings restricting to admins
CREATE POLICY "Admins can view guardrail settings"
ON public.guardrail_settings FOR SELECT
TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role));

-- Fix 2: Prevent anonymous listing of avatars bucket while preserving public file access via CDN URLs
DROP POLICY IF EXISTS "Public can view avatars" ON storage.objects;
CREATE POLICY "Authenticated users can view avatars"
ON storage.objects FOR SELECT
TO authenticated
USING (bucket_id = 'avatars');
