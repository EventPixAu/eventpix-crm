-- Create staff_availability table for photographer availability tracking
CREATE TABLE public.staff_availability (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  date date NOT NULL,
  availability_status text NOT NULL DEFAULT 'available' CHECK (availability_status IN ('available', 'limited', 'unavailable')),
  notes text,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  UNIQUE(user_id, date)
);

-- Add default_photographers_required to event_series for staffing forecasts
ALTER TABLE public.event_series
ADD COLUMN default_photographers_required integer DEFAULT 1;

-- Add assignment_override to audit_action enum for tracking overrides
ALTER TYPE public.audit_action ADD VALUE IF NOT EXISTS 'assignment_override';

-- Enable RLS on staff_availability
ALTER TABLE public.staff_availability ENABLE ROW LEVEL SECURITY;

-- Staff can view and manage their own availability
CREATE POLICY "Staff can manage own availability"
ON public.staff_availability
FOR ALL
USING (user_id = auth.uid())
WITH CHECK (user_id = auth.uid());

-- Admins can view all availability
CREATE POLICY "Admins can view all availability"
ON public.staff_availability
FOR SELECT
USING (has_role(auth.uid(), 'admin'::app_role));

-- Admins can manage all availability (for overrides)
CREATE POLICY "Admins can manage all availability"
ON public.staff_availability
FOR ALL
USING (has_role(auth.uid(), 'admin'::app_role));

-- Create updated_at trigger for staff_availability
CREATE TRIGGER update_staff_availability_updated_at
BEFORE UPDATE ON public.staff_availability
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Create index for fast availability lookups
CREATE INDEX idx_staff_availability_user_date ON public.staff_availability(user_id, date);
CREATE INDEX idx_staff_availability_date ON public.staff_availability(date);