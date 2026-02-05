-- Update user_invitations check constraint to include new roles
ALTER TABLE public.user_invitations DROP CONSTRAINT IF EXISTS user_invitations_role_check;

ALTER TABLE public.user_invitations 
ADD CONSTRAINT user_invitations_role_check 
CHECK (role = ANY (ARRAY['admin'::text, 'sales'::text, 'operations'::text, 'crew'::text, 'photographer'::text, 'assistant'::text]));