-- Create staff_rates table for internal rate tracking
CREATE TABLE public.staff_rates (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  rate_type TEXT NOT NULL CHECK (rate_type IN ('hourly', 'half_day', 'full_day', 'event')),
  base_rate NUMERIC NOT NULL CHECK (base_rate >= 0),
  currency TEXT NOT NULL DEFAULT 'AUD',
  effective_from DATE NOT NULL DEFAULT CURRENT_DATE,
  effective_to DATE,
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Create staff_event_feedback table for post-event performance notes
CREATE TABLE public.staff_event_feedback (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  event_id UUID NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  rating INTEGER NOT NULL CHECK (rating >= 1 AND rating <= 5),
  notes TEXT,
  created_by UUID NOT NULL REFERENCES public.profiles(id),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  UNIQUE(event_id, user_id)
);

-- Add estimated_cost to event_assignments
ALTER TABLE public.event_assignments ADD COLUMN estimated_cost NUMERIC;

-- Add cost_threshold to events for warning when exceeded
ALTER TABLE public.events ADD COLUMN cost_threshold NUMERIC;

-- Enable RLS on new tables
ALTER TABLE public.staff_rates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.staff_event_feedback ENABLE ROW LEVEL SECURITY;

-- RLS policies for staff_rates (admin only)
CREATE POLICY "Admins can manage staff_rates"
  ON public.staff_rates
  FOR ALL
  USING (has_role(auth.uid(), 'admin'::app_role));

-- RLS policies for staff_event_feedback (admin only)
CREATE POLICY "Admins can manage staff_event_feedback"
  ON public.staff_event_feedback
  FOR ALL
  USING (has_role(auth.uid(), 'admin'::app_role));

-- Create index for performance
CREATE INDEX idx_staff_rates_user_id ON public.staff_rates(user_id);
CREATE INDEX idx_staff_rates_effective ON public.staff_rates(user_id, effective_from, effective_to);
CREATE INDEX idx_staff_event_feedback_user_id ON public.staff_event_feedback(user_id);
CREATE INDEX idx_staff_event_feedback_event_id ON public.staff_event_feedback(event_id);

-- Add audit trigger for rate changes
CREATE OR REPLACE FUNCTION public.audit_rate_changes()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_data jsonb;
  v_actor uuid;
BEGIN
  v_actor := auth.uid();
  
  IF TG_OP = 'INSERT' THEN
    v_data := jsonb_build_object(
      'user_id', NEW.user_id,
      'rate_type', NEW.rate_type,
      'base_rate', NEW.base_rate,
      'effective_from', NEW.effective_from
    );
    INSERT INTO public.audit_log (actor_user_id, event_id, action, after)
    VALUES (v_actor, NULL, 'event_updated', v_data);
  ELSIF TG_OP = 'UPDATE' THEN
    v_data := jsonb_build_object(
      'user_id', NEW.user_id,
      'rate_type', NEW.rate_type,
      'base_rate_old', OLD.base_rate,
      'base_rate_new', NEW.base_rate
    );
    INSERT INTO public.audit_log (actor_user_id, event_id, action, before, after)
    VALUES (v_actor, NULL, 'event_updated', 
      jsonb_build_object('base_rate', OLD.base_rate),
      jsonb_build_object('base_rate', NEW.base_rate));
  END IF;
  
  RETURN NEW;
END;
$function$;

CREATE TRIGGER audit_staff_rate_changes
  AFTER INSERT OR UPDATE ON public.staff_rates
  FOR EACH ROW
  EXECUTE FUNCTION public.audit_rate_changes();

-- Update timestamp trigger for staff_rates
CREATE TRIGGER update_staff_rates_updated_at
  BEFORE UPDATE ON public.staff_rates
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();