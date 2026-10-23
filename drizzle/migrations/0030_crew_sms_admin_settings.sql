ALTER TABLE public.crew_sms_settings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins update SMS settings" ON public.crew_sms_settings;
CREATE POLICY "Admins update SMS settings" ON public.crew_sms_settings
  FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));

DROP POLICY IF EXISTS "Admins insert SMS settings" ON public.crew_sms_settings;
CREATE POLICY "Admins insert SMS settings" ON public.crew_sms_settings
  FOR INSERT TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));