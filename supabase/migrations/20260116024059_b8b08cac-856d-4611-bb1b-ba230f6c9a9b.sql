-- =============================================
-- UNIFIED DATA MODEL - INCREMENTAL MIGRATION
-- =============================================

-- 1. NEW LOOKUP TABLES
-- =============================================

-- Coverage Packages lookup
CREATE TABLE IF NOT EXISTS public.coverage_packages (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name text NOT NULL,
  description text,
  hours_included numeric,
  photographers_included integer DEFAULT 1,
  is_active boolean DEFAULT true,
  sort_order integer DEFAULT 0,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now()
);

ALTER TABLE public.coverage_packages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admin can manage coverage_packages" ON public.coverage_packages
  FOR ALL USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Authenticated can read coverage_packages" ON public.coverage_packages
  FOR SELECT USING (auth.uid() IS NOT NULL);

-- Contact Relationship Types lookup
CREATE TABLE IF NOT EXISTS public.contact_relationship_types (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name text NOT NULL,
  description text,
  is_active boolean DEFAULT true,
  sort_order integer DEFAULT 0,
  created_at timestamp with time zone DEFAULT now()
);

ALTER TABLE public.contact_relationship_types ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admin can manage contact_relationship_types" ON public.contact_relationship_types
  FOR ALL USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Authenticated can read contact_relationship_types" ON public.contact_relationship_types
  FOR SELECT USING (auth.uid() IS NOT NULL);

-- Lost Reasons lookup
CREATE TABLE IF NOT EXISTS public.lost_reasons (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name text NOT NULL,
  description text,
  is_active boolean DEFAULT true,
  sort_order integer DEFAULT 0,
  created_at timestamp with time zone DEFAULT now()
);

ALTER TABLE public.lost_reasons ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admin can manage lost_reasons" ON public.lost_reasons
  FOR ALL USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Sales and Admin can read lost_reasons" ON public.lost_reasons
  FOR SELECT USING (can_access_sales(auth.uid()));

-- 2. VENUES TABLE (new)
-- =============================================

CREATE TABLE IF NOT EXISTS public.venues (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name text NOT NULL,
  address_line_1 text,
  address_line_2 text,
  suburb text,
  state text,
  postcode text,
  country text DEFAULT 'Australia',
  parking_notes text,
  access_notes text,
  primary_contact_name text,
  primary_contact_phone text,
  primary_contact_email text,
  is_active boolean DEFAULT true,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now()
);

ALTER TABLE public.venues ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admin can manage venues" ON public.venues
  FOR ALL USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Sales can manage venues" ON public.venues
  FOR ALL USING (can_access_sales(auth.uid()));

CREATE POLICY "Staff can view venues" ON public.venues
  FOR SELECT USING (has_role(auth.uid(), 'photographer'::app_role));

-- 3. REBOOKING PROFILES TABLE (new)
-- =============================================

CREATE TABLE IF NOT EXISTS public.rebooking_profiles (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  client_id uuid NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  typical_event_month integer CHECK (typical_event_month >= 1 AND typical_event_month <= 12),
  typical_lead_time_days integer DEFAULT 60,
  rebook_contact_id uuid REFERENCES public.client_contacts(id) ON DELETE SET NULL,
  rebook_notes text,
  last_event_at timestamp with time zone,
  next_expected_event_at timestamp with time zone,
  auto_remind boolean DEFAULT true,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  UNIQUE(client_id)
);

ALTER TABLE public.rebooking_profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admin can manage rebooking_profiles" ON public.rebooking_profiles
  FOR ALL USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Sales can manage rebooking_profiles" ON public.rebooking_profiles
  FOR ALL USING (can_access_sales(auth.uid()));

-- 4. TASKS TABLE (new general task system)
-- =============================================

CREATE TABLE IF NOT EXISTS public.tasks (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  related_type text NOT NULL CHECK (related_type IN ('client', 'contact', 'lead', 'event', 'delivery')),
  related_id uuid NOT NULL,
  task_type text NOT NULL DEFAULT 'follow_up' CHECK (task_type IN ('follow_up', 'call', 'email', 'prep', 'delivery_check', 'other')),
  title text NOT NULL,
  description text,
  due_at timestamp with time zone,
  assigned_to uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  status text NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'done', 'snoozed', 'cancelled')),
  priority text DEFAULT 'normal' CHECK (priority IN ('low', 'normal', 'high', 'urgent')),
  snoozed_until timestamp with time zone,
  completed_at timestamp with time zone,
  completed_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now()
);

ALTER TABLE public.tasks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admin can manage all tasks" ON public.tasks
  FOR ALL USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Sales can manage sales-related tasks" ON public.tasks
  FOR ALL USING (can_access_sales(auth.uid()) AND related_type IN ('client', 'contact', 'lead'));

CREATE POLICY "Users can view assigned tasks" ON public.tasks
  FOR SELECT USING (assigned_to = auth.uid());

CREATE POLICY "Users can update assigned tasks" ON public.tasks
  FOR UPDATE USING (assigned_to = auth.uid());

CREATE POLICY "Staff can manage event tasks" ON public.tasks
  FOR ALL USING (
    related_type = 'event' AND 
    EXISTS (
      SELECT 1 FROM event_assignments ea 
      WHERE ea.event_id = tasks.related_id AND ea.user_id = auth.uid()
    )
  );

-- Index for task queries
CREATE INDEX IF NOT EXISTS idx_tasks_related ON public.tasks(related_type, related_id);
CREATE INDEX IF NOT EXISTS idx_tasks_assigned ON public.tasks(assigned_to, status);
CREATE INDEX IF NOT EXISTS idx_tasks_due ON public.tasks(due_at) WHERE status = 'open';

-- 5. AUTOMATIONS TABLE (new)
-- =============================================

CREATE TABLE IF NOT EXISTS public.automations (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name text NOT NULL,
  description text,
  trigger_type text NOT NULL CHECK (trigger_type IN ('date_relative', 'status_change', 'assignment_created', 'event_created', 'delivery_completed')),
  trigger_config jsonb NOT NULL DEFAULT '{}',
  action_type text NOT NULL CHECK (action_type IN ('create_task', 'send_email', 'send_notification', 'update_status')),
  action_config jsonb NOT NULL DEFAULT '{}',
  is_active boolean DEFAULT true,
  created_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now()
);

ALTER TABLE public.automations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admin can manage automations" ON public.automations
  FOR ALL USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Authenticated can view active automations" ON public.automations
  FOR SELECT USING (is_active = true AND auth.uid() IS NOT NULL);

-- 6. ADD FIELDS TO EXISTING TABLES
-- =============================================

-- Add fields to clients
ALTER TABLE public.clients 
  ADD COLUMN IF NOT EXISTS legal_name text,
  ADD COLUMN IF NOT EXISTS trading_name text,
  ADD COLUMN IF NOT EXISTS industry text,
  ADD COLUMN IF NOT EXISTS abn text,
  ADD COLUMN IF NOT EXISTS website text,
  ADD COLUMN IF NOT EXISTS status text DEFAULT 'active' CHECK (status IN ('active', 'inactive', 'prospect'));

-- Add fields to client_contacts
ALTER TABLE public.client_contacts
  ADD COLUMN IF NOT EXISTS first_name text,
  ADD COLUMN IF NOT EXISTS last_name text,
  ADD COLUMN IF NOT EXISTS relationship_type_id uuid REFERENCES public.contact_relationship_types(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS consent_status text DEFAULT 'unknown' CHECK (consent_status IN ('unknown', 'opted_in', 'opted_out')),
  ADD COLUMN IF NOT EXISTS consent_source text,
  ADD COLUMN IF NOT EXISTS last_contacted_at timestamp with time zone;

-- Add fields to leads (serves as enquiries)
ALTER TABLE public.leads
  ADD COLUMN IF NOT EXISTS received_at timestamp with time zone DEFAULT now(),
  ADD COLUMN IF NOT EXISTS event_month_hint integer CHECK (event_month_hint >= 1 AND event_month_hint <= 12),
  ADD COLUMN IF NOT EXISTS venue_text text,
  ADD COLUMN IF NOT EXISTS requirements_summary text,
  ADD COLUMN IF NOT EXISTS owner_priority text DEFAULT 'normal' CHECK (owner_priority IN ('low', 'normal', 'high')),
  ADD COLUMN IF NOT EXISTS lost_reason_id uuid REFERENCES public.lost_reasons(id) ON DELETE SET NULL;

-- Add venue_id and coverage_package_id to events
ALTER TABLE public.events
  ADD COLUMN IF NOT EXISTS venue_id uuid REFERENCES public.venues(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS coverage_package_id uuid REFERENCES public.coverage_packages(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS run_sheet_url text,
  ADD COLUMN IF NOT EXISTS special_instructions text;

-- Add fields to event_assignments
ALTER TABLE public.event_assignments
  ADD COLUMN IF NOT EXISTS call_time_at timestamp with time zone,
  ADD COLUMN IF NOT EXISTS wrap_time_at timestamp with time zone,
  ADD COLUMN IF NOT EXISTS assignment_status text DEFAULT 'assigned' CHECK (assignment_status IN ('assigned', 'accepted', 'declined', 'replaced'));

-- Add client_access_token to delivery_records for secure public access
ALTER TABLE public.delivery_records
  ADD COLUMN IF NOT EXISTS client_access_token text,
  ADD COLUMN IF NOT EXISTS delivery_status text DEFAULT 'planned' CHECK (delivery_status IN ('planned', 'in_progress', 'delivered', 'failed'));

-- 7. ENQUIRY_CONTACTS JUNCTION TABLE (for many-to-many)
-- =============================================

CREATE TABLE IF NOT EXISTS public.enquiry_contacts (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  lead_id uuid NOT NULL REFERENCES public.leads(id) ON DELETE CASCADE,
  contact_id uuid NOT NULL REFERENCES public.client_contacts(id) ON DELETE CASCADE,
  role text DEFAULT 'primary',
  created_at timestamp with time zone DEFAULT now(),
  UNIQUE(lead_id, contact_id)
);

ALTER TABLE public.enquiry_contacts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Sales and Admin can manage enquiry_contacts" ON public.enquiry_contacts
  FOR ALL USING (can_access_sales(auth.uid()));

-- 8. SEED DEFAULT LOOKUP DATA
-- =============================================

-- Default contact relationship types
INSERT INTO public.contact_relationship_types (name, sort_order) VALUES
  ('Client Contact', 1),
  ('Sponsor Contact', 2),
  ('Venue Contact', 3),
  ('Industry Contact', 4),
  ('Other', 5)
ON CONFLICT DO NOTHING;

-- Default lost reasons
INSERT INTO public.lost_reasons (name, sort_order) VALUES
  ('Budget', 1),
  ('Timing', 2),
  ('Chose Competitor', 3),
  ('Event Cancelled', 4),
  ('No Response', 5),
  ('Other', 6)
ON CONFLICT DO NOTHING;

-- 9. UPDATE TIMESTAMP TRIGGERS
-- =============================================

CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

-- Apply triggers to new tables
DROP TRIGGER IF EXISTS update_venues_updated_at ON public.venues;
CREATE TRIGGER update_venues_updated_at
  BEFORE UPDATE ON public.venues
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS update_rebooking_profiles_updated_at ON public.rebooking_profiles;
CREATE TRIGGER update_rebooking_profiles_updated_at
  BEFORE UPDATE ON public.rebooking_profiles
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS update_tasks_updated_at ON public.tasks;
CREATE TRIGGER update_tasks_updated_at
  BEFORE UPDATE ON public.tasks
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS update_automations_updated_at ON public.automations;
CREATE TRIGGER update_automations_updated_at
  BEFORE UPDATE ON public.automations
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS update_coverage_packages_updated_at ON public.coverage_packages;
CREATE TRIGGER update_coverage_packages_updated_at
  BEFORE UPDATE ON public.coverage_packages
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();