
CREATE TABLE public.editing_instruction_templates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  description text,
  content text NOT NULL DEFAULT '',
  is_active boolean NOT NULL DEFAULT true,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.editing_instruction_templates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can read editing instruction templates"
ON public.editing_instruction_templates FOR SELECT TO authenticated
USING (true);

CREATE POLICY "Authenticated users can manage editing instruction templates"
ON public.editing_instruction_templates FOR ALL TO authenticated
USING (true) WITH CHECK (true);

-- Add template reference to events
ALTER TABLE public.events
  ADD COLUMN IF NOT EXISTS editing_instructions_template_id uuid REFERENCES public.editing_instruction_templates(id);
