-- Add staff capability fields to profiles
ALTER TABLE public.profiles
ADD COLUMN IF NOT EXISTS home_city text,
ADD COLUMN IF NOT EXISTS home_state text,
ADD COLUMN IF NOT EXISTS travel_ready boolean DEFAULT false,
ADD COLUMN IF NOT EXISTS preferred_start_time time,
ADD COLUMN IF NOT EXISTS preferred_end_time time,
ADD COLUMN IF NOT EXISTS notes_internal text,
ADD COLUMN IF NOT EXISTS seniority text DEFAULT 'mid' CHECK (seniority IN ('lead', 'mid', 'junior'));

-- Add location fields to events
ALTER TABLE public.events
ADD COLUMN IF NOT EXISTS city text,
ADD COLUMN IF NOT EXISTS state text,
ADD COLUMN IF NOT EXISTS venue_postcode text;

-- Add default roles to event_series
ALTER TABLE public.event_series
ADD COLUMN IF NOT EXISTS default_roles_json jsonb;

-- Create skills lookup table
CREATE TABLE IF NOT EXISTS public.skills (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text UNIQUE NOT NULL,
  created_at timestamptz DEFAULT now()
);

-- Enable RLS on skills
ALTER TABLE public.skills ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated can read skills" ON public.skills
  FOR SELECT USING (true);

CREATE POLICY "Admins can manage skills" ON public.skills
  FOR ALL USING (has_role(auth.uid(), 'admin'));

-- Seed skills
INSERT INTO public.skills (name) VALUES
  ('Corporate Awards'),
  ('Red Carpet'),
  ('Stage and Presentations'),
  ('Media Wall'),
  ('Candid Networking'),
  ('On-Camera Flash'),
  ('Low Light Events'),
  ('Fast Turnaround Gallery'),
  ('VIP Handling')
ON CONFLICT (name) DO NOTHING;

-- Create staff_skills join table
CREATE TABLE IF NOT EXISTS public.staff_skills (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  skill_id uuid NOT NULL REFERENCES public.skills(id) ON DELETE CASCADE,
  created_at timestamptz DEFAULT now(),
  UNIQUE(user_id, skill_id)
);

-- Enable RLS on staff_skills
ALTER TABLE public.staff_skills ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated can read staff_skills" ON public.staff_skills
  FOR SELECT USING (true);

CREATE POLICY "Admins can manage staff_skills" ON public.staff_skills
  FOR ALL USING (has_role(auth.uid(), 'admin'));

CREATE POLICY "Staff can manage own skills" ON public.staff_skills
  FOR ALL USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- Create assignment_drafts table
CREATE TABLE IF NOT EXISTS public.assignment_drafts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_by uuid REFERENCES public.profiles(id),
  scope text NOT NULL CHECK (scope IN ('single_event', 'bulk', 'series')),
  event_ids uuid[] NOT NULL,
  draft_json jsonb NOT NULL,
  status text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'applied', 'discarded')),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Enable RLS on assignment_drafts
ALTER TABLE public.assignment_drafts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage assignment_drafts" ON public.assignment_drafts
  FOR ALL USING (has_role(auth.uid(), 'admin'));

-- Add trigger for updated_at
CREATE TRIGGER update_assignment_drafts_updated_at
  BEFORE UPDATE ON public.assignment_drafts
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();