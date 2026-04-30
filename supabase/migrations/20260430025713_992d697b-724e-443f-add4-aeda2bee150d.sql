DROP TRIGGER IF EXISTS trg_generate_client_portal_token ON public.events;

CREATE TRIGGER trg_generate_client_portal_token
BEFORE INSERT ON public.events
FOR EACH ROW
EXECUTE FUNCTION public.generate_client_portal_token();

DROP POLICY IF EXISTS "Public can view events by client portal token" ON public.events;

CREATE POLICY "Public can view events by client portal token"
ON public.events
FOR SELECT
TO anon
USING (client_portal_token IS NOT NULL);