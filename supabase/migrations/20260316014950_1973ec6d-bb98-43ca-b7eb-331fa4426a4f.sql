ALTER TABLE public.workflow_master_steps 
ADD COLUMN default_staff_role_id uuid REFERENCES public.staff_roles(id) ON DELETE SET NULL DEFAULT NULL;