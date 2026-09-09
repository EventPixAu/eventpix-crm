ALTER TABLE public.event_series
  ADD COLUMN IF NOT EXISTS default_delivery_method_photographer_id uuid REFERENCES public.delivery_methods_lookup(id);