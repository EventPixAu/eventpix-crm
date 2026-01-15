-- Create event_series table for grouping related events
CREATE TABLE public.event_series (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  event_type_id UUID REFERENCES public.event_types(id) ON DELETE SET NULL,
  default_coverage_details TEXT,
  default_delivery_method_id UUID REFERENCES public.delivery_methods_lookup(id) ON DELETE SET NULL,
  default_delivery_deadline_days INTEGER DEFAULT 5,
  notes TEXT,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Add event_series_id to events table
ALTER TABLE public.events 
ADD COLUMN event_series_id UUID REFERENCES public.event_series(id) ON DELETE SET NULL;

-- Enable RLS on event_series
ALTER TABLE public.event_series ENABLE ROW LEVEL SECURITY;

-- Admins can manage event series
CREATE POLICY "Admins can manage event_series" 
ON public.event_series 
FOR ALL 
USING (has_role(auth.uid(), 'admin'::app_role));

-- Staff can view event series
CREATE POLICY "Staff can view event_series" 
ON public.event_series 
FOR SELECT 
USING (has_role(auth.uid(), 'photographer'::app_role));

-- Add index for faster lookups
CREATE INDEX idx_events_series_id ON public.events(event_series_id);

-- Create trigger for updated_at
CREATE TRIGGER update_event_series_updated_at
BEFORE UPDATE ON public.event_series
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();