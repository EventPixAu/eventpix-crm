DROP POLICY "Admin and Sales can read email templates" ON public.email_templates;

CREATE POLICY "Admin, Sales, and Operations can read email templates"
  ON public.email_templates
  FOR SELECT
  TO authenticated
  USING (
    has_role(auth.uid(), 'admin'::app_role)
    OR has_role(auth.uid(), 'sales'::app_role)
    OR has_role(auth.uid(), 'operations'::app_role)
  );