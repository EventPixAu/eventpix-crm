
CREATE TABLE public.series_default_equipment (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  series_id UUID NOT NULL REFERENCES public.event_series(id) ON DELETE CASCADE,
  equipment_item_id UUID REFERENCES public.equipment_items(id) ON DELETE CASCADE,
  kit_id UUID REFERENCES public.equipment_kits(id) ON DELETE CASCADE,
  notes TEXT,
  sort_order INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  CONSTRAINT series_default_equipment_one_target CHECK (
    (equipment_item_id IS NOT NULL)::int + (kit_id IS NOT NULL)::int = 1
  )
);

CREATE UNIQUE INDEX series_default_equipment_unique_item
  ON public.series_default_equipment(series_id, equipment_item_id)
  WHERE equipment_item_id IS NOT NULL;

CREATE UNIQUE INDEX series_default_equipment_unique_kit
  ON public.series_default_equipment(series_id, kit_id)
  WHERE kit_id IS NOT NULL;

CREATE INDEX series_default_equipment_series_idx ON public.series_default_equipment(series_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.series_default_equipment TO authenticated;
GRANT ALL ON public.series_default_equipment TO service_role;

ALTER TABLE public.series_default_equipment ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins and ops can view series default equipment"
  ON public.series_default_equipment FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'operations'));

CREATE POLICY "Admins and ops can insert series default equipment"
  ON public.series_default_equipment FOR INSERT TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'operations'));

CREATE POLICY "Admins and ops can update series default equipment"
  ON public.series_default_equipment FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'operations'));

CREATE POLICY "Admins and ops can delete series default equipment"
  ON public.series_default_equipment FOR DELETE TO authenticated
  USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'operations'));
