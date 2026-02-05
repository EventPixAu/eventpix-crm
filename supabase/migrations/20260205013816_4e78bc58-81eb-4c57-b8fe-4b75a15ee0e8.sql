-- Create table for series default staff assignments
-- Staff assigned here will be automatically assigned to all events in the series

CREATE TABLE public.series_default_assignments (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  series_id UUID NOT NULL REFERENCES public.event_series(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  staff_role_id UUID REFERENCES public.staff_roles(id) ON DELETE SET NULL,
  assignment_notes TEXT,
  sort_order INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by UUID REFERENCES public.profiles(id),
  UNIQUE(series_id, user_id)
);

-- Enable RLS
ALTER TABLE public.series_default_assignments ENABLE ROW LEVEL SECURITY;

-- RLS policies for admin/ops access using has_role function
CREATE POLICY "Admins and ops can manage series default assignments"
  ON public.series_default_assignments
  FOR ALL
  USING (
    public.has_role(auth.uid(), 'admin'::app_role) OR 
    public.has_role(auth.uid(), 'operations'::app_role)
  );

-- Allow authenticated users to view (for crew visibility)
CREATE POLICY "Authenticated users can view series default assignments"
  ON public.series_default_assignments
  FOR SELECT
  USING (auth.uid() IS NOT NULL);

-- Add comments
COMMENT ON TABLE public.series_default_assignments IS 'Default staff assignments for event series - staff listed here are auto-assigned to new events in the series';
COMMENT ON COLUMN public.series_default_assignments.series_id IS 'The event series these defaults apply to';
COMMENT ON COLUMN public.series_default_assignments.user_id IS 'The staff member to assign by default';
COMMENT ON COLUMN public.series_default_assignments.staff_role_id IS 'The role for this assignment';