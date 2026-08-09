
ALTER TABLE public.venues
  ADD COLUMN IF NOT EXISTS full_address text,
  ADD COLUMN IF NOT EXISTS website text,
  ADD COLUMN IF NOT EXISTS venue_type text,
  ADD COLUMN IF NOT EXISTS parking_access text,
  ADD COLUMN IF NOT EXISTS parking_cost text,
  ADD COLUMN IF NOT EXISTS public_wifi_ssid text,
  ADD COLUMN IF NOT EXISTS public_wifi_password text,
  ADD COLUMN IF NOT EXISTS event_wifi_ssid text,
  ADD COLUMN IF NOT EXISTS event_wifi_password text,
  ADD COLUMN IF NOT EXISTS internet_notes text,
  ADD COLUMN IF NOT EXISTS telstra_signal text NOT NULL DEFAULT 'Not Tested',
  ADD COLUMN IF NOT EXISTS optus_signal text NOT NULL DEFAULT 'Not Tested',
  ADD COLUMN IF NOT EXISTS signal_notes text,
  ADD COLUMN IF NOT EXISTS events_dept_phone text,
  ADD COLUMN IF NOT EXISTS events_dept_email text,
  ADD COLUMN IF NOT EXISTS events_contact_name text,
  ADD COLUMN IF NOT EXISTS events_contact_phone text,
  ADD COLUMN IF NOT EXISTS events_contact_email text,
  ADD COLUMN IF NOT EXISTS last_visited date,
  ADD COLUMN IF NOT EXISTS is_confirmed boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS ai_filled_fields jsonb NOT NULL DEFAULT '[]'::jsonb;

CREATE TABLE IF NOT EXISTS public.venue_notes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  venue_id uuid NOT NULL REFERENCES public.venues(id) ON DELETE CASCADE,
  note text NOT NULL,
  created_by uuid REFERENCES auth.users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.venue_notes TO authenticated;
GRANT ALL ON public.venue_notes TO service_role;

ALTER TABLE public.venue_notes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated can view venue notes"
  ON public.venue_notes FOR SELECT TO authenticated USING (true);

CREATE POLICY "Authenticated can add venue notes"
  ON public.venue_notes FOR INSERT TO authenticated WITH CHECK (auth.uid() = created_by);

CREATE POLICY "Authors or admins can update venue notes"
  ON public.venue_notes FOR UPDATE TO authenticated
  USING (auth.uid() = created_by OR public.is_admin());

CREATE POLICY "Authors or admins can delete venue notes"
  ON public.venue_notes FOR DELETE TO authenticated
  USING (auth.uid() = created_by OR public.is_admin());

CREATE TRIGGER update_venue_notes_updated_at
  BEFORE UPDATE ON public.venue_notes
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE INDEX IF NOT EXISTS idx_venue_notes_venue_id ON public.venue_notes(venue_id);
CREATE INDEX IF NOT EXISTS idx_events_venue_id ON public.events(venue_id);
