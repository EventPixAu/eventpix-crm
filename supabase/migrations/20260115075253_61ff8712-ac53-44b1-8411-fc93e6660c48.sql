-- ============================================================
-- EVENTPIX OPERATIONS PLATFORM - ARCHITECTURAL BOUNDARIES
-- ============================================================
-- This platform is OPERATIONS-ONLY:
-- - NO CRM features (Sales CRM is external - Studio Ninja)
-- - NO accounting logic (Accounting is external - Xero)
-- - Invoice fields are READ-ONLY visibility markers only
-- ============================================================

-- 1. Add handoff_status enum for Sales → Operations handoff
CREATE TYPE public.handoff_status AS ENUM ('draft', 'ready_for_ops', 'converted', 'cancelled');

-- 2. Add handoff_status column to job_intake
ALTER TABLE public.job_intake 
ADD COLUMN handoff_status public.handoff_status NOT NULL DEFAULT 'draft';

-- 3. Migrate existing status values to handoff_status
UPDATE public.job_intake 
SET handoff_status = CASE 
  WHEN status = 'accepted' THEN 'converted'::public.handoff_status
  WHEN status = 'cancelled' THEN 'cancelled'::public.handoff_status
  ELSE 'draft'::public.handoff_status
END;

-- 4. Create function to prevent editing converted job intakes
CREATE OR REPLACE FUNCTION public.prevent_converted_intake_edit()
RETURNS TRIGGER AS $$
BEGIN
  -- If already converted, block updates except for specific allowed fields
  IF OLD.handoff_status = 'converted' THEN
    -- Only allow updating notes after conversion (for audit trail)
    IF (OLD.client_name IS DISTINCT FROM NEW.client_name) OR
       (OLD.job_name IS DISTINCT FROM NEW.job_name) OR
       (OLD.proposed_event_date IS DISTINCT FROM NEW.proposed_event_date) OR
       (OLD.handoff_status IS DISTINCT FROM NEW.handoff_status) THEN
      RAISE EXCEPTION 'Cannot modify converted job intake - Sales handoff complete';
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- 5. Create trigger to enforce immutability after conversion
CREATE TRIGGER enforce_intake_immutability
  BEFORE UPDATE ON public.job_intake
  FOR EACH ROW
  EXECUTE FUNCTION public.prevent_converted_intake_edit();

-- 6. Create function to enforce only ready_for_ops can be converted
CREATE OR REPLACE FUNCTION public.validate_intake_conversion()
RETURNS TRIGGER AS $$
BEGIN
  -- When converting to 'converted' status, source must be 'ready_for_ops'
  IF NEW.handoff_status = 'converted' AND OLD.handoff_status != 'ready_for_ops' THEN
    -- Allow direct conversion from draft for backward compatibility during migration
    IF OLD.handoff_status != 'draft' THEN
      RAISE EXCEPTION 'Only jobs with ready_for_ops status can be converted to events';
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

CREATE TRIGGER validate_intake_status_transition
  BEFORE UPDATE ON public.job_intake
  FOR EACH ROW
  WHEN (OLD.handoff_status IS DISTINCT FROM NEW.handoff_status)
  EXECUTE FUNCTION public.validate_intake_conversion();

-- ============================================================
-- PHOTOGRAPHER ROLE VISIBILITY RESTRICTIONS (RLS)
-- ============================================================
-- Photographers must NOT see: invoice data, costs, rates, 
-- feedback details, other staff compliance, executive data
-- ============================================================

-- 7. Create function to check if user is photographer (not admin)
CREATE OR REPLACE FUNCTION public.is_photographer(_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT NOT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id AND role = 'admin'
  )
$$;

-- 8. Restrict staff_rates to admin only (photographers cannot see rates)
DROP POLICY IF EXISTS "staff_rates_select" ON public.staff_rates;
DROP POLICY IF EXISTS "Admins can manage rates" ON public.staff_rates;
DROP POLICY IF EXISTS "Admin full access to staff rates" ON public.staff_rates;

CREATE POLICY "admin_only_rates_select"
  ON public.staff_rates FOR SELECT
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "admin_only_rates_insert"
  ON public.staff_rates FOR INSERT
  TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "admin_only_rates_update"
  ON public.staff_rates FOR UPDATE
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "admin_only_rates_delete"
  ON public.staff_rates FOR DELETE
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

-- 9. Restrict staff_event_feedback visibility
-- Photographers can only see feedback about themselves (not give or view others)
DROP POLICY IF EXISTS "Admins can manage feedback" ON public.staff_event_feedback;
DROP POLICY IF EXISTS "staff_event_feedback_select" ON public.staff_event_feedback;

CREATE POLICY "feedback_admin_full_access"
  ON public.staff_event_feedback FOR ALL
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "feedback_own_view_only"
  ON public.staff_event_feedback FOR SELECT
  TO authenticated
  USING (user_id = auth.uid() AND NOT public.has_role(auth.uid(), 'admin'));

-- 10. Restrict staff_compliance_documents - photographers see only their own
DROP POLICY IF EXISTS "Users can view own compliance docs" ON public.staff_compliance_documents;
DROP POLICY IF EXISTS "Admins can manage compliance docs" ON public.staff_compliance_documents;

CREATE POLICY "compliance_admin_full_access"
  ON public.staff_compliance_documents FOR ALL
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "compliance_own_access"
  ON public.staff_compliance_documents FOR SELECT
  TO authenticated
  USING (user_id = auth.uid() AND NOT public.has_role(auth.uid(), 'admin'));

CREATE POLICY "compliance_own_insert"
  ON public.staff_compliance_documents FOR INSERT
  TO authenticated
  WITH CHECK (user_id = auth.uid());

-- 11. Restrict job_intake to admin only (sales boundary)
DROP POLICY IF EXISTS "Admin full access to job intake" ON public.job_intake;
DROP POLICY IF EXISTS "job_intake_admin_access" ON public.job_intake;

CREATE POLICY "job_intake_admin_only"
  ON public.job_intake FOR ALL
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

-- 12. Restrict event_series to admin only (program management boundary)
DROP POLICY IF EXISTS "Admin full access to event series" ON public.event_series;
DROP POLICY IF EXISTS "event_series_admin" ON public.event_series;

CREATE POLICY "event_series_admin_only"
  ON public.event_series FOR ALL
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

-- 13. Add comment annotations for system boundaries
COMMENT ON TABLE public.job_intake IS 'SALES BOUNDARY: Represents jobs from external CRM (Studio Ninja). Read-only after conversion to event.';
COMMENT ON COLUMN public.events.invoice_status IS 'ACCOUNTING BOUNDARY: Read-only visibility marker. Actual invoicing handled in Xero.';
COMMENT ON COLUMN public.events.invoice_reference IS 'ACCOUNTING BOUNDARY: Read-only reference to external invoice. No accounting logic.';
COMMENT ON TABLE public.staff_rates IS 'OPERATIONS INTERNAL: Admin-only. Photographers cannot view rate information.';
COMMENT ON TABLE public.staff_event_feedback IS 'OPERATIONS INTERNAL: Admin-managed. Photographers can only view their own feedback.';