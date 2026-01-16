-- Create notifications table
CREATE TABLE public.notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  type text NOT NULL,
  title text NOT NULL,
  message text NOT NULL,
  entity_type text,
  entity_id uuid,
  severity text NOT NULL DEFAULT 'info' CHECK (severity IN ('info', 'warning', 'critical')),
  is_read boolean NOT NULL DEFAULT false,
  delivery_channel text NOT NULL DEFAULT 'in_app' CHECK (delivery_channel IN ('in_app', 'email_stub')),
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Create index for efficient queries
CREATE INDEX idx_notifications_user_unread ON public.notifications(user_id, is_read, created_at DESC);
CREATE INDEX idx_notifications_created_at ON public.notifications(created_at DESC);
CREATE INDEX idx_notifications_dedupe ON public.notifications(user_id, type, entity_type, entity_id, created_at DESC);

-- Enable RLS
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

-- Users can read their own notifications
CREATE POLICY "Users can view their own notifications"
ON public.notifications
FOR SELECT
USING (auth.uid() = user_id);

-- Admins can read all notifications
CREATE POLICY "Admins can view all notifications"
ON public.notifications
FOR SELECT
USING (public.has_role(auth.uid(), 'admin'));

-- System/functions can insert notifications (via service role or authenticated)
CREATE POLICY "System can insert notifications"
ON public.notifications
FOR INSERT
WITH CHECK (true);

-- Users can update their own notifications (mark as read)
CREATE POLICY "Users can update their own notifications"
ON public.notifications
FOR UPDATE
USING (auth.uid() = user_id);

-- No deletes allowed (mark as read only)

-- Add email_notifications_enabled to profiles for stub
ALTER TABLE public.profiles
ADD COLUMN IF NOT EXISTS email_notifications_enabled boolean DEFAULT true;

-- Create function to create notification with deduplication
CREATE OR REPLACE FUNCTION public.create_notification(
  p_user_id uuid,
  p_type text,
  p_title text,
  p_message text,
  p_entity_type text DEFAULT NULL,
  p_entity_id uuid DEFAULT NULL,
  p_severity text DEFAULT 'info',
  p_dedupe_hours int DEFAULT 24
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_notification_id uuid;
  v_existing_id uuid;
BEGIN
  -- Check for existing notification within dedupe window
  SELECT id INTO v_existing_id
  FROM public.notifications
  WHERE user_id = p_user_id
    AND type = p_type
    AND entity_type IS NOT DISTINCT FROM p_entity_type
    AND entity_id IS NOT DISTINCT FROM p_entity_id
    AND created_at > now() - (p_dedupe_hours || ' hours')::interval
  LIMIT 1;
  
  -- If exists, return null (dedupe)
  IF v_existing_id IS NOT NULL THEN
    RETURN NULL;
  END IF;
  
  -- Insert new notification
  INSERT INTO public.notifications (user_id, type, title, message, entity_type, entity_id, severity)
  VALUES (p_user_id, p_type, p_title, p_message, p_entity_type, p_entity_id, p_severity)
  RETURNING id INTO v_notification_id;
  
  RETURN v_notification_id;
END;
$$;

-- Grant execute to authenticated users (for RPC calls)
GRANT EXECUTE ON FUNCTION public.create_notification TO authenticated;