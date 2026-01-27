-- Add role-based filtering to crew checklist templates
-- Templates can now be assigned to specific staff roles (Lead Photographer, Assistant, Videographer, etc.)

-- Add staff_role_id to link templates to specific roles
ALTER TABLE public.crew_checklist_templates
ADD COLUMN staff_role_id uuid REFERENCES public.staff_roles(id) ON DELETE SET NULL;

-- Add index for efficient role-based lookups
CREATE INDEX idx_crew_checklist_templates_role ON public.crew_checklist_templates(staff_role_id);

-- Allow admins to manage crew checklist templates
CREATE POLICY "Admins can manage crew checklist templates"
ON public.crew_checklist_templates
FOR ALL
TO authenticated
USING (public.has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));

-- Allow crew and photographers to read active templates
CREATE POLICY "Crew can read active checklist templates"
ON public.crew_checklist_templates
FOR SELECT
TO authenticated
USING (
  is_active = true AND (
    public.has_role(auth.uid(), 'crew'::app_role) OR
    public.has_role(auth.uid(), 'photographer'::app_role)
  )
);

-- Enable RLS on the table
ALTER TABLE public.crew_checklist_templates ENABLE ROW LEVEL SECURITY;