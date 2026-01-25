-- Add staff_id column to user_invitations to track staff-to-user linking
ALTER TABLE public.user_invitations 
ADD COLUMN staff_id uuid REFERENCES public.staff(id) ON DELETE SET NULL;

-- Create an index for faster lookups
CREATE INDEX idx_user_invitations_staff_id ON public.user_invitations(staff_id) WHERE staff_id IS NOT NULL;

-- Comment for clarity
COMMENT ON COLUMN public.user_invitations.staff_id IS 'Optional link to staff record for migrating staff-only members to full user accounts';