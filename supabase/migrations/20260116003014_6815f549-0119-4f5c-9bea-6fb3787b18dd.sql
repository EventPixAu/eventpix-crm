-- Create helper function to check if user is executive
CREATE OR REPLACE FUNCTION public.is_executive(_user_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id AND role = 'executive'
  )
$$;

-- Create helper function to check executive or admin
CREATE OR REPLACE FUNCTION public.is_executive_or_admin(_user_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id AND role IN ('admin', 'executive')
  )
$$;

-- RLS Policies for Executive Read-Only Access
-- Executives can READ events (no edit)
CREATE POLICY "Executives can view events"
ON public.events
FOR SELECT
TO authenticated
USING (public.is_executive(auth.uid()));

-- Executives can READ event_assignments (for staffing counts)
CREATE POLICY "Executives can view event assignments"
ON public.event_assignments
FOR SELECT
TO authenticated
USING (public.is_executive(auth.uid()));

-- Executives can READ event_series
CREATE POLICY "Executives can view event series"
ON public.event_series
FOR SELECT
TO authenticated
USING (public.is_executive(auth.uid()));

-- Executives can READ delivery_records
CREATE POLICY "Executives can view delivery records"
ON public.delivery_records
FOR SELECT
TO authenticated
USING (public.is_executive(auth.uid()));

-- Executives can READ equipment_allocations (status only)
CREATE POLICY "Executives can view equipment allocations"
ON public.equipment_allocations
FOR SELECT
TO authenticated
USING (public.is_executive(auth.uid()));

-- Executives can READ staff_compliance_documents (status only, not documents)
CREATE POLICY "Executives can view compliance doc status"
ON public.staff_compliance_documents
FOR SELECT
TO authenticated
USING (public.is_executive(auth.uid()));

-- Executives can READ audit_log
CREATE POLICY "Executives can view audit log"
ON public.audit_log
FOR SELECT
TO authenticated
USING (public.is_executive(auth.uid()));

-- Executives can READ profiles (limited - only counts, no personal data exposed in dashboard)
CREATE POLICY "Executives can view profiles for counts"
ON public.profiles
FOR SELECT
TO authenticated
USING (public.is_executive(auth.uid()));

-- Executives can READ event_types
CREATE POLICY "Executives can view event types"
ON public.event_types
FOR SELECT
TO authenticated
USING (public.is_executive(auth.uid()));

-- Executives can READ guardrail_overrides
CREATE POLICY "Executives can view guardrail overrides"
ON public.guardrail_overrides
FOR SELECT
TO authenticated
USING (public.is_executive(auth.uid()));

-- Executives can READ event_sessions (for session indicators)
CREATE POLICY "Executives can view event sessions"
ON public.event_sessions
FOR SELECT
TO authenticated
USING (public.is_executive(auth.uid()));

-- Executives can READ staff_event_feedback (for rating metrics)
CREATE POLICY "Executives can view staff feedback"
ON public.staff_event_feedback
FOR SELECT
TO authenticated
USING (public.is_executive(auth.uid()));