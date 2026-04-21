-- 1. Restrict contracts public SELECT: drop the broad anon policy and provide a secure RPC instead
DROP POLICY IF EXISTS "Public can view contracts by valid token" ON public.contracts;

CREATE OR REPLACE FUNCTION public.get_contract_by_public_token(p_token text)
RETURNS TABLE (
  id uuid,
  title text,
  status text,
  file_url text,
  rendered_html text,
  signed_at timestamptz,
  signed_by_name text,
  signature_data text
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    c.id,
    c.title,
    c.status::text,
    c.file_url,
    c.rendered_html,
    c.signed_at,
    c.signed_by_name,
    c.signature_data
  FROM public.contracts c
  WHERE c.public_token IS NOT NULL
    AND p_token IS NOT NULL
    AND length(p_token) >= 10
    AND c.public_token = p_token
  LIMIT 1;
$$;

GRANT EXECUTE ON FUNCTION public.get_contract_by_public_token(text) TO anon, authenticated;

-- 2. Tighten notifications INSERT policy
DROP POLICY IF EXISTS "System can insert notifications" ON public.notifications;

CREATE POLICY "Authenticated users can insert their own notifications"
ON public.notifications
FOR INSERT
TO authenticated
WITH CHECK (
  user_id = auth.uid() OR public.is_admin()
);

-- 3. Make sensitive storage buckets private
UPDATE storage.buckets SET public = false WHERE id = 'compliance-documents';
UPDATE storage.buckets SET public = false WHERE id = 'lead-files';