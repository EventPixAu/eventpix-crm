
-- Editor master steps (mirror of workflow_master_steps)
CREATE TABLE public.editor_workflow_master_steps (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  label text NOT NULL,
  phase text NOT NULL,
  sort_order integer NOT NULL DEFAULT 0,
  completion_type text NOT NULL DEFAULT 'manual',
  auto_trigger_event text,
  date_offset_days integer,
  date_offset_reference text,
  help_text text,
  is_active boolean NOT NULL DEFAULT true,
  default_staff_role_id uuid,
  default_assignee_user_id uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.editor_workflow_master_steps TO authenticated;
GRANT ALL ON public.editor_workflow_master_steps TO service_role;

ALTER TABLE public.editor_workflow_master_steps ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone authenticated can view editor master steps"
  ON public.editor_workflow_master_steps FOR SELECT
  USING (auth.uid() IS NOT NULL);

CREATE POLICY "Admins can manage editor master steps"
  ON public.editor_workflow_master_steps FOR ALL
  USING (is_admin());

CREATE TRIGGER update_editor_workflow_master_steps_updated_at
  BEFORE UPDATE ON public.editor_workflow_master_steps
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Editor event type defaults (mirror of event_type_step_defaults)
CREATE TABLE public.editor_event_type_step_defaults (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  event_type_id uuid NOT NULL,
  master_step_id uuid NOT NULL REFERENCES public.editor_workflow_master_steps(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (event_type_id, master_step_id)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.editor_event_type_step_defaults TO authenticated;
GRANT ALL ON public.editor_event_type_step_defaults TO service_role;

ALTER TABLE public.editor_event_type_step_defaults ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone authenticated can view editor step defaults"
  ON public.editor_event_type_step_defaults FOR SELECT
  USING (auth.uid() IS NOT NULL);

CREATE POLICY "Admins can manage editor step defaults"
  ON public.editor_event_type_step_defaults FOR ALL
  USING (is_admin());

-- Seed editor master steps by duplicating operations steps; keep old id in a temp mapping via matching on identical (label, phase, sort_order).
WITH inserted AS (
  INSERT INTO public.editor_workflow_master_steps
    (label, phase, sort_order, completion_type, auto_trigger_event, date_offset_days, date_offset_reference, help_text, is_active, default_staff_role_id, default_assignee_user_id)
  SELECT label, phase, sort_order, completion_type, auto_trigger_event, date_offset_days, date_offset_reference, help_text, is_active, default_staff_role_id, default_assignee_user_id
  FROM public.workflow_master_steps
  RETURNING id, label, phase, sort_order
)
INSERT INTO public.editor_event_type_step_defaults (event_type_id, master_step_id)
SELECT d.event_type_id, i.id
FROM public.event_type_step_defaults d
JOIN public.workflow_master_steps o ON o.id = d.master_step_id
JOIN inserted i ON i.label = o.label AND i.phase = o.phase AND i.sort_order = o.sort_order
ON CONFLICT DO NOTHING;
