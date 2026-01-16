-- Phase 4: Crew Experience Enhancements

-- Add photography-specific fields to events (Phase 4.2)
ALTER TABLE public.events
ADD COLUMN IF NOT EXISTS photography_brief text NULL,
ADD COLUMN IF NOT EXISTS camera_settings text NULL,
ADD COLUMN IF NOT EXISTS dress_code text NULL;

-- Create crew checklist templates table (Admin manages these)
CREATE TABLE IF NOT EXISTS public.crew_checklist_templates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  description text NULL,
  items jsonb NOT NULL DEFAULT '[]'::jsonb, -- Array of { item_text: string, sort_order: number }
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Insert default crew checklist template
INSERT INTO public.crew_checklist_templates (name, description, items)
VALUES (
  'Standard Crew Checklist',
  'Default checklist for photographers and assistants',
  '[
    {"item_text": "Gear check - all required equipment packed", "sort_order": 1},
    {"item_text": "Batteries fully charged", "sort_order": 2},
    {"item_text": "Memory cards formatted", "sort_order": 3},
    {"item_text": "Arrival confirmed with client/manager", "sort_order": 4},
    {"item_text": "Files uploaded post-event", "sort_order": 5}
  ]'::jsonb
);

-- Create crew checklists table (per staff, per event)
CREATE TABLE IF NOT EXISTS public.crew_checklists (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id uuid NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  template_id uuid NULL REFERENCES public.crew_checklist_templates(id) ON DELETE SET NULL,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(event_id, user_id) -- One checklist per staff per event
);

-- Create crew checklist items table
CREATE TABLE IF NOT EXISTS public.crew_checklist_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  checklist_id uuid NOT NULL REFERENCES public.crew_checklists(id) ON DELETE CASCADE,
  item_text text NOT NULL,
  sort_order integer NOT NULL DEFAULT 0,
  is_done boolean NOT NULL DEFAULT false,
  done_at timestamptz NULL,
  notes text NULL,
  created_at timestamptz DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.crew_checklist_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.crew_checklists ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.crew_checklist_items ENABLE ROW LEVEL SECURITY;

-- RLS for crew_checklist_templates (Admin can manage, all can read active)
CREATE POLICY "Anyone can read active templates"
ON public.crew_checklist_templates FOR SELECT
USING (is_active = true);

CREATE POLICY "Admin can manage templates"
ON public.crew_checklist_templates FOR ALL
USING (public.current_user_role() = 'admin');

-- RLS for crew_checklists (crew can manage their own)
CREATE POLICY "Users can view their own checklists"
ON public.crew_checklists FOR SELECT
USING (auth.uid() = user_id OR public.current_user_role() IN ('admin', 'operations'));

CREATE POLICY "Users can create their own checklists"
ON public.crew_checklists FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own checklists"
ON public.crew_checklists FOR UPDATE
USING (auth.uid() = user_id);

CREATE POLICY "Admin/Ops can manage all checklists"
ON public.crew_checklists FOR ALL
USING (public.current_user_role() IN ('admin', 'operations'));

-- RLS for crew_checklist_items
CREATE POLICY "Users can view their checklist items"
ON public.crew_checklist_items FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.crew_checklists c
    WHERE c.id = crew_checklist_items.checklist_id
    AND (c.user_id = auth.uid() OR public.current_user_role() IN ('admin', 'operations'))
  )
);

CREATE POLICY "Users can manage their checklist items"
ON public.crew_checklist_items FOR ALL
USING (
  EXISTS (
    SELECT 1 FROM public.crew_checklists c
    WHERE c.id = crew_checklist_items.checklist_id
    AND c.user_id = auth.uid()
  )
);

CREATE POLICY "Admin/Ops can manage all checklist items"
ON public.crew_checklist_items FOR ALL
USING (public.current_user_role() IN ('admin', 'operations'));

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_crew_checklists_event ON public.crew_checklists(event_id);
CREATE INDEX IF NOT EXISTS idx_crew_checklists_user ON public.crew_checklists(user_id);
CREATE INDEX IF NOT EXISTS idx_crew_checklist_items_checklist ON public.crew_checklist_items(checklist_id);