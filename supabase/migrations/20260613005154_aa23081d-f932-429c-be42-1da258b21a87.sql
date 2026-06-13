
-- 1. Contact notes table (timestamped, multi-note history)
CREATE TABLE IF NOT EXISTS public.client_contact_notes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  contact_id uuid NOT NULL REFERENCES public.client_contacts(id) ON DELETE CASCADE,
  note text NOT NULL,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_client_contact_notes_contact ON public.client_contact_notes(contact_id, created_at DESC);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.client_contact_notes TO authenticated;
GRANT ALL ON public.client_contact_notes TO service_role;

ALTER TABLE public.client_contact_notes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated can view contact notes"
  ON public.client_contact_notes FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated can insert contact notes"
  ON public.client_contact_notes FOR INSERT TO authenticated WITH CHECK (auth.uid() = created_by);
CREATE POLICY "Authors or admins can update contact notes"
  ON public.client_contact_notes FOR UPDATE TO authenticated
  USING (created_by = auth.uid() OR has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Authors or admins can delete contact notes"
  ON public.client_contact_notes FOR DELETE TO authenticated
  USING (created_by = auth.uid() OR has_role(auth.uid(), 'admin'::app_role));

CREATE TRIGGER trg_client_contact_notes_updated_at
  BEFORE UPDATE ON public.client_contact_notes
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 2. Trigger to log status/category changes into contact_activities
CREATE OR REPLACE FUNCTION public.log_contact_status_category_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.status IS DISTINCT FROM OLD.status THEN
    INSERT INTO public.contact_activities (contact_id, activity_type, activity_date, subject, notes, created_by)
    VALUES (
      NEW.id,
      'status_change',
      now(),
      'Status changed',
      'Status changed from ' || COALESCE(OLD.status, 'Unassigned') || ' to ' || COALESCE(NEW.status, 'Unassigned'),
      auth.uid()
    );
  END IF;
  IF NEW.category IS DISTINCT FROM OLD.category THEN
    INSERT INTO public.contact_activities (contact_id, activity_type, activity_date, subject, notes, created_by)
    VALUES (
      NEW.id,
      'category_change',
      now(),
      'Category changed',
      'Category changed from ' || COALESCE(OLD.category, 'Unassigned') || ' to ' || COALESCE(NEW.category, 'Unassigned'),
      auth.uid()
    );
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_log_contact_status_category_change ON public.client_contacts;
CREATE TRIGGER trg_log_contact_status_category_change
  AFTER UPDATE OF status, category ON public.client_contacts
  FOR EACH ROW EXECUTE FUNCTION public.log_contact_status_category_change();
