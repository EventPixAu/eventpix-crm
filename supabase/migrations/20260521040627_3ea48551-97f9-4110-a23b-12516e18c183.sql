
-- events: drop overly permissive anon policy
DROP POLICY IF EXISTS "Public can view events by client portal token" ON public.events;

-- client_brief_templates: restrict writes to admin/operations
DROP POLICY IF EXISTS "Authenticated users can manage client brief templates" ON public.client_brief_templates;
CREATE POLICY "Admin and ops can manage client brief templates"
ON public.client_brief_templates
FOR ALL
TO authenticated
USING (public.has_role(auth.uid(), 'admin'::app_role) OR public.can_access_operations(auth.uid()))
WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role) OR public.can_access_operations(auth.uid()));

-- lead_notes: restrict to sales/operations/admin
DROP POLICY IF EXISTS "Authenticated users can view lead notes" ON public.lead_notes;
DROP POLICY IF EXISTS "Authenticated users can create lead notes" ON public.lead_notes;
CREATE POLICY "Sales, ops, admin can view lead notes"
ON public.lead_notes
FOR SELECT
TO authenticated
USING (
  public.has_role(auth.uid(), 'admin'::app_role)
  OR public.can_access_sales(auth.uid())
  OR public.can_access_operations(auth.uid())
);
CREATE POLICY "Sales, ops, admin can create lead notes"
ON public.lead_notes
FOR INSERT
TO authenticated
WITH CHECK (
  (created_by = auth.uid())
  AND (
    public.has_role(auth.uid(), 'admin'::app_role)
    OR public.can_access_sales(auth.uid())
    OR public.can_access_operations(auth.uid())
  )
);

-- audit_log: tighten insert
DROP POLICY IF EXISTS "Users can insert their own audit logs" ON public.audit_log;
CREATE POLICY "Users can insert their own audit logs"
ON public.audit_log
FOR INSERT
TO authenticated
WITH CHECK (actor_user_id = auth.uid());

-- crew_checklist_templates: restrict public read to authenticated only
DROP POLICY IF EXISTS "Anyone can read active templates" ON public.crew_checklist_templates;
CREATE POLICY "Authenticated can read active checklist templates"
ON public.crew_checklist_templates
FOR SELECT
TO authenticated
USING (is_active = true);

-- oauth_states for CSRF protection (Xero etc.)
CREATE TABLE IF NOT EXISTS public.oauth_states (
  state text PRIMARY KEY,
  provider text NOT NULL,
  user_id uuid,
  expires_at timestamptz NOT NULL DEFAULT (now() + interval '15 minutes'),
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.oauth_states ENABLE ROW LEVEL SECURITY;
-- No policies: only service role (which bypasses RLS) accesses this table.
