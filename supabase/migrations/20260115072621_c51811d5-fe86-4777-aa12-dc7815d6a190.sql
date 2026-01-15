-- Add skill nomination workflow columns to staff_skills
ALTER TABLE public.staff_skills
ADD COLUMN status text NOT NULL DEFAULT 'approved',
ADD COLUMN reviewed_at timestamp with time zone,
ADD COLUMN reviewed_by uuid REFERENCES auth.users(id),
ADD COLUMN rejected_reason text;

-- Add check constraint for valid status values
ALTER TABLE public.staff_skills
ADD CONSTRAINT staff_skills_status_check 
CHECK (status IN ('pending', 'approved', 'rejected'));

-- Add notification preferences to profiles
ALTER TABLE public.profiles
ADD COLUMN notification_preferences jsonb DEFAULT '{
  "email_on_assignment": true,
  "email_on_changes": true,
  "in_app_notifications": true
}'::jsonb;

-- Update RLS policy for staff_skills to allow staff to insert pending skills
DROP POLICY IF EXISTS "Staff can manage own skills" ON public.staff_skills;

CREATE POLICY "Staff can insert own pending skills"
ON public.staff_skills
FOR INSERT
TO authenticated
WITH CHECK (
  user_id = auth.uid() 
  AND status = 'pending'
);

CREATE POLICY "Staff can view own skills"
ON public.staff_skills
FOR SELECT
TO authenticated
USING (user_id = auth.uid() OR has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Staff can delete own pending skills"
ON public.staff_skills
FOR DELETE
TO authenticated
USING (user_id = auth.uid() AND status = 'pending');

-- Create index for skill review queue
CREATE INDEX idx_staff_skills_pending ON public.staff_skills(status) WHERE status = 'pending';

-- Create index for notification preferences queries
CREATE INDEX idx_profiles_notification_prefs ON public.profiles USING GIN (notification_preferences);