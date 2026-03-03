
ALTER TABLE public.events ADD COLUMN IF NOT EXISTS client_brief_template_id UUID REFERENCES public.client_brief_templates(id);
