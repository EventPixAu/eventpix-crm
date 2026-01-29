-- 1. Create master operations steps table (single flat list)
CREATE TABLE IF NOT EXISTS public.workflow_master_steps (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  label TEXT NOT NULL,
  phase TEXT NOT NULL CHECK (phase IN ('pre_event', 'day_of', 'post_event')),
  sort_order INTEGER NOT NULL DEFAULT 0,
  completion_type TEXT NOT NULL DEFAULT 'manual' CHECK (completion_type IN ('manual', 'auto')),
  auto_trigger_event TEXT,
  date_offset_days INTEGER,
  date_offset_reference TEXT CHECK (date_offset_reference IN ('lead_created', 'job_accepted', 'event_date', 'delivery_deadline')),
  help_text TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- 2. Create event type step defaults (links event types to specific steps)
CREATE TABLE IF NOT EXISTS public.event_type_step_defaults (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  event_type_id UUID NOT NULL REFERENCES public.event_types(id) ON DELETE CASCADE,
  master_step_id UUID NOT NULL REFERENCES public.workflow_master_steps(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(event_type_id, master_step_id)
);

-- 3. Enable RLS
ALTER TABLE public.workflow_master_steps ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.event_type_step_defaults ENABLE ROW LEVEL SECURITY;

-- 4. RLS Policies for workflow_master_steps
CREATE POLICY "Anyone authenticated can view master steps" ON public.workflow_master_steps
  FOR SELECT USING (auth.uid() IS NOT NULL);

CREATE POLICY "Admins can manage master steps" ON public.workflow_master_steps
  FOR ALL USING (public.is_admin());

-- 5. RLS Policies for event_type_step_defaults
CREATE POLICY "Anyone authenticated can view step defaults" ON public.event_type_step_defaults
  FOR SELECT USING (auth.uid() IS NOT NULL);

CREATE POLICY "Admins can manage step defaults" ON public.event_type_step_defaults
  FOR ALL USING (public.is_admin());