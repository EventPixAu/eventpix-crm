-- Create event brief templates table
CREATE TABLE public.event_brief_templates (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  content TEXT NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT true,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Add brief template reference to events
ALTER TABLE public.events 
ADD COLUMN brief_template_id UUID REFERENCES public.event_brief_templates(id),
ADD COLUMN brief_content TEXT,
ADD COLUMN brief_updated_at TIMESTAMP WITH TIME ZONE;

-- Enable RLS
ALTER TABLE public.event_brief_templates ENABLE ROW LEVEL SECURITY;

-- RLS policies for brief templates (authenticated users can read)
CREATE POLICY "Authenticated users can view brief templates"
ON public.event_brief_templates
FOR SELECT
USING (auth.role() = 'authenticated');

-- RLS policies for brief templates (admins can manage via user_roles table)
CREATE POLICY "Admins can manage brief templates"
ON public.event_brief_templates
FOR ALL
USING (
  EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_roles.user_id = auth.uid()
    AND user_roles.role = 'admin'
  )
);

-- Create trigger for updated_at
CREATE TRIGGER update_event_brief_templates_updated_at
BEFORE UPDATE ON public.event_brief_templates
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Insert some default templates
INSERT INTO public.event_brief_templates (name, description, content, sort_order) VALUES
('Standard Corporate Event', 'Default brief for corporate photography events', 'Standard corporate event coverage including arrivals, presentations, networking, and group photos.', 1),
('Conference Coverage', 'Multi-day conference photography brief', 'Full conference coverage including keynotes, breakout sessions, exhibition areas, and delegate networking.', 2),
('Awards Night', 'Awards ceremony and gala photography', 'Coverage of arrivals, red carpet, award presentations, winners portraits, and celebration moments.', 3);