
CREATE TABLE public.crew_checklist_template_event_types (
  template_id UUID NOT NULL REFERENCES public.crew_checklist_templates(id) ON DELETE CASCADE,
  event_type_id UUID NOT NULL REFERENCES public.event_types(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (template_id, event_type_id)
);

CREATE INDEX idx_ccltet_event_type ON public.crew_checklist_template_event_types(event_type_id);

ALTER TABLE public.crew_checklist_template_event_types ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated can read template event types"
ON public.crew_checklist_template_event_types
FOR SELECT TO authenticated USING (true);

CREATE POLICY "Admins can manage template event types"
ON public.crew_checklist_template_event_types
FOR ALL TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (has_role(auth.uid(), 'admin'::app_role));
