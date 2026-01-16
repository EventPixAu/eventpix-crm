-- Fix log_audit_entry to prevent audit trail forgery
-- Remove actor_user_id parameter and use auth.uid() internally

CREATE OR REPLACE FUNCTION public.log_audit_entry(
  p_event_id uuid,
  p_action audit_action,
  p_before jsonb DEFAULT NULL,
  p_after jsonb DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_id uuid;
BEGIN
  -- Use auth.uid() to enforce actor is the authenticated user
  INSERT INTO public.audit_log (actor_user_id, event_id, action, before, after)
  VALUES (auth.uid(), p_event_id, p_action, p_before, p_after)
  RETURNING id INTO v_id;
  RETURN v_id;
END;
$$;

-- Also fix the RLS policy to be more restrictive
DROP POLICY IF EXISTS "System can insert audit logs" ON public.audit_log;

-- Only authenticated users can insert audit logs
CREATE POLICY "Authenticated users can insert audit logs"
ON public.audit_log
FOR INSERT
WITH CHECK (auth.uid() IS NOT NULL);

-- Secure gallery_assets - require authentication for viewing
DROP POLICY IF EXISTS "Public can view gallery assets" ON public.gallery_assets;

CREATE POLICY "Authenticated users can view gallery assets"
ON public.gallery_assets FOR SELECT
USING (auth.uid() IS NOT NULL);

-- Update storage policy for gallery images
DROP POLICY IF EXISTS "Public can view gallery images" ON storage.objects;

CREATE POLICY "Authenticated users can view gallery images"
ON storage.objects FOR SELECT
USING (
  bucket_id = 'eventpix-galleries' 
  AND auth.uid() IS NOT NULL
);

-- Make gallery bucket private
UPDATE storage.buckets 
SET public = false 
WHERE id = 'eventpix-galleries';