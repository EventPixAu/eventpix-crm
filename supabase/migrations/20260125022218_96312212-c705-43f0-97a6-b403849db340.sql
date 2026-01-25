-- Fix overly permissive email_logs RLS policies
-- Drop the existing permissive policies that expose data to all authenticated users
DROP POLICY IF EXISTS "Authenticated users can view email logs" ON public.email_logs;
DROP POLICY IF EXISTS "Authenticated users can create email logs" ON public.email_logs;
DROP POLICY IF EXISTS "Authenticated users can update email logs" ON public.email_logs;

-- Admins and sales can view all email logs
CREATE POLICY "Admins and sales can view email logs"
  ON public.email_logs FOR SELECT
  USING (can_access_sales(auth.uid()) OR has_role(auth.uid(), 'admin'::app_role));

-- Users can view emails they sent
CREATE POLICY "Users can view own sent emails"
  ON public.email_logs FOR SELECT
  USING (sent_by = auth.uid());

-- Operations can view emails for events they're assigned to
CREATE POLICY "Operations can view emails for assigned events"
  ON public.email_logs FOR SELECT
  USING (
    can_access_operations(auth.uid()) AND
    event_id IS NOT NULL AND
    is_assigned_to_event(auth.uid(), event_id)
  );

-- Executives can view all for reporting
CREATE POLICY "Executives can view email logs"
  ON public.email_logs FOR SELECT
  USING (is_executive(auth.uid()));

-- Admins and sales can create email logs (they send the emails)
CREATE POLICY "Admins and sales can create email logs"
  ON public.email_logs FOR INSERT
  WITH CHECK (can_access_sales(auth.uid()) OR has_role(auth.uid(), 'admin'::app_role));

-- Allow users to create logs for emails they send (via RPC functions)
CREATE POLICY "Users can create own email logs"
  ON public.email_logs FOR INSERT
  WITH CHECK (sent_by = auth.uid());

-- Admins and sales can update email logs (for tracking updates)
CREATE POLICY "Admins and sales can update email logs"
  ON public.email_logs FOR UPDATE
  USING (can_access_sales(auth.uid()) OR has_role(auth.uid(), 'admin'::app_role));

-- Allow tracking updates on emails the user sent
CREATE POLICY "Users can update own email logs"
  ON public.email_logs FOR UPDATE
  USING (sent_by = auth.uid());