-- Add is_active column to workflow_template_items for soft delete
ALTER TABLE public.workflow_template_items 
ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT true;

-- Create event_type_workflow_defaults mapping table
CREATE TABLE public.event_type_workflow_defaults (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_type_id UUID NOT NULL REFERENCES public.event_types(id) ON DELETE CASCADE,
  template_id UUID NOT NULL REFERENCES public.workflow_templates(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(event_type_id, template_id)
);

-- Enable RLS
ALTER TABLE public.event_type_workflow_defaults ENABLE ROW LEVEL SECURITY;

-- Admins can manage event type defaults
CREATE POLICY "Admins can manage event_type_workflow_defaults" 
ON public.event_type_workflow_defaults 
FOR ALL 
USING (has_role(auth.uid(), 'admin'::app_role));

-- Authenticated can read event type defaults (needed for event creation)
CREATE POLICY "Authenticated can read event_type_workflow_defaults" 
ON public.event_type_workflow_defaults 
FOR SELECT 
USING (true);

-- Update the create_worksheets_for_event function to use event type defaults
CREATE OR REPLACE FUNCTION public.create_worksheets_for_event()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  tmpl RECORD;
  ws_id UUID;
  item RECORD;
  has_defaults BOOLEAN;
BEGIN
  -- Check if event type has specific template defaults
  SELECT EXISTS (
    SELECT 1 FROM public.event_type_workflow_defaults 
    WHERE event_type_id = NEW.event_type_id
  ) INTO has_defaults;
  
  IF has_defaults THEN
    -- Use only templates mapped to this event type
    FOR tmpl IN 
      SELECT wt.* FROM public.workflow_templates wt
      INNER JOIN public.event_type_workflow_defaults etwd ON etwd.template_id = wt.id
      WHERE etwd.event_type_id = NEW.event_type_id AND wt.is_active = true
    LOOP
      INSERT INTO public.worksheets (event_id, template_id, template_name, phase, status)
      VALUES (NEW.id, tmpl.id, tmpl.template_name, tmpl.phase, 'not_started')
      RETURNING id INTO ws_id;
      
      -- Create worksheet items from active template items only
      FOR item IN SELECT * FROM public.workflow_template_items 
                  WHERE template_id = tmpl.id AND is_active = true 
                  ORDER BY sort_order
      LOOP
        INSERT INTO public.worksheet_items (worksheet_id, template_item_id, item_text, sort_order, is_done)
        VALUES (ws_id, item.id, item.label, item.sort_order, false);
      END LOOP;
    END LOOP;
  ELSE
    -- Fallback: use all active templates
    FOR tmpl IN SELECT * FROM public.workflow_templates WHERE is_active = true
    LOOP
      INSERT INTO public.worksheets (event_id, template_id, template_name, phase, status)
      VALUES (NEW.id, tmpl.id, tmpl.template_name, tmpl.phase, 'not_started')
      RETURNING id INTO ws_id;
      
      -- Create worksheet items from active template items only
      FOR item IN SELECT * FROM public.workflow_template_items 
                  WHERE template_id = tmpl.id AND is_active = true 
                  ORDER BY sort_order
      LOOP
        INSERT INTO public.worksheet_items (worksheet_id, template_item_id, item_text, sort_order, is_done)
        VALUES (ws_id, item.id, item.label, item.sort_order, false);
      END LOOP;
    END LOOP;
  END IF;
  
  RETURN NEW;
END;
$$;