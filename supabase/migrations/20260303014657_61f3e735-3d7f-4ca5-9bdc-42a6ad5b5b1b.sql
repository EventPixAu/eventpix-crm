
CREATE TABLE public.client_brief_templates (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  content TEXT NOT NULL DEFAULT '',
  is_active BOOLEAN NOT NULL DEFAULT true,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.client_brief_templates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view client brief templates"
  ON public.client_brief_templates FOR SELECT TO authenticated USING (true);

CREATE POLICY "Authenticated users can manage client brief templates"
  ON public.client_brief_templates FOR ALL TO authenticated USING (true) WITH CHECK (true);
