-- Create job titles lookup table
CREATE TABLE public.job_titles (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name text NOT NULL UNIQUE,
  sort_order integer DEFAULT 0,
  is_active boolean DEFAULT true,
  created_at timestamptz DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.job_titles ENABLE ROW LEVEL SECURITY;

-- Policies
CREATE POLICY "Admin can manage job_titles" 
ON public.job_titles FOR ALL 
USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Authenticated can read job_titles" 
ON public.job_titles FOR SELECT 
USING (auth.uid() IS NOT NULL);

-- Insert the predefined job titles
INSERT INTO public.job_titles (name, sort_order) VALUES
  ('Owner', 1),
  ('Assistant EA/PA/AA', 2),
  ('Producer', 3),
  ('Event Manager', 4),
  ('Marketing Manager', 5),
  ('Social Media Manager', 6);

-- Add job_title_id to client_contacts
ALTER TABLE public.client_contacts 
ADD COLUMN IF NOT EXISTS job_title_id uuid REFERENCES public.job_titles(id);

-- Create contact activities table for timeline
CREATE TABLE public.contact_activities (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  contact_id uuid NOT NULL REFERENCES public.client_contacts(id) ON DELETE CASCADE,
  activity_type text NOT NULL CHECK (activity_type IN ('email', 'phone_call', 'meeting')),
  activity_date timestamptz NOT NULL DEFAULT now(),
  subject text,
  notes text,
  created_by uuid REFERENCES auth.users(id),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.contact_activities ENABLE ROW LEVEL SECURITY;

-- Policies for contact_activities
CREATE POLICY "Sales and Admin can manage contact_activities" 
ON public.contact_activities FOR ALL 
USING (can_access_sales(auth.uid()));

CREATE POLICY "Operations can view contact_activities" 
ON public.contact_activities FOR SELECT 
USING (is_operations(auth.uid()));

-- Create index for performance
CREATE INDEX idx_contact_activities_contact_id ON public.contact_activities(contact_id);
CREATE INDEX idx_contact_activities_date ON public.contact_activities(activity_date DESC);