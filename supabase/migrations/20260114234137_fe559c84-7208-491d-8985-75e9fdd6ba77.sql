-- Create enum types
CREATE TYPE public.staff_role AS ENUM ('photographer', 'videographer', 'assistant');
CREATE TYPE public.staff_status AS ENUM ('active', 'inactive');
CREATE TYPE public.event_type AS ENUM ('wedding', 'corporate', 'birthday', 'conference', 'gala', 'festival', 'private', 'sports', 'other');
CREATE TYPE public.delivery_method AS ENUM ('dropbox', 'zno_instant', 'spotmyphotos', 'internal_gallery');
CREATE TYPE public.workflow_phase AS ENUM ('pre_event', 'day_of', 'post_event');
CREATE TYPE public.worksheet_item_status AS ENUM ('pending', 'in_progress', 'completed');
CREATE TYPE public.app_role AS ENUM ('admin', 'photographer');

-- Create profiles table
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  full_name TEXT,
  avatar_url TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create user_roles table for role-based access
CREATE TABLE public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  role app_role NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (user_id, role)
);

-- Create staff table
CREATE TABLE public.staff (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  name TEXT NOT NULL,
  role staff_role NOT NULL DEFAULT 'photographer',
  email TEXT NOT NULL UNIQUE,
  phone TEXT,
  status staff_status NOT NULL DEFAULT 'active',
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create events table
CREATE TABLE public.events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_name TEXT NOT NULL,
  event_type event_type NOT NULL DEFAULT 'other',
  event_date DATE NOT NULL,
  start_time TIME,
  end_time TIME,
  venue_name TEXT,
  venue_address TEXT,
  client_name TEXT NOT NULL,
  onsite_contact_name TEXT,
  onsite_contact_phone TEXT,
  coverage_details TEXT,
  delivery_method delivery_method,
  delivery_deadline DATE,
  notes TEXT,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create event_assignments table
CREATE TABLE public.event_assignments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id UUID REFERENCES public.events(id) ON DELETE CASCADE NOT NULL,
  staff_id UUID REFERENCES public.staff(id) ON DELETE CASCADE NOT NULL,
  role_on_event TEXT,
  notes TEXT,
  notified BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (event_id, staff_id)
);

-- Create workflow_templates table
CREATE TABLE public.workflow_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  template_name TEXT NOT NULL,
  phase workflow_phase NOT NULL,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create workflow_template_items table
CREATE TABLE public.workflow_template_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  template_id UUID REFERENCES public.workflow_templates(id) ON DELETE CASCADE NOT NULL,
  item_text TEXT NOT NULL,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create worksheets table (instantiated from templates for events)
CREATE TABLE public.worksheets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id UUID REFERENCES public.events(id) ON DELETE CASCADE NOT NULL,
  template_id UUID REFERENCES public.workflow_templates(id) ON DELETE SET NULL,
  template_name TEXT NOT NULL,
  phase workflow_phase NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create worksheet_items table
CREATE TABLE public.worksheet_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  worksheet_id UUID REFERENCES public.worksheets(id) ON DELETE CASCADE NOT NULL,
  item_text TEXT NOT NULL,
  sort_order INTEGER NOT NULL DEFAULT 0,
  status worksheet_item_status NOT NULL DEFAULT 'pending',
  completed_by UUID REFERENCES auth.users(id),
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create delivery_records table
CREATE TABLE public.delivery_records (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id UUID REFERENCES public.events(id) ON DELETE CASCADE NOT NULL,
  delivery_method delivery_method NOT NULL,
  delivery_link TEXT,
  qr_code_data TEXT,
  delivered_at TIMESTAMPTZ,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS on all tables
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.staff ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.event_assignments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.workflow_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.workflow_template_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.worksheets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.worksheet_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.delivery_records ENABLE ROW LEVEL SECURITY;

-- Create security definer function for role checking
CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role app_role)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE user_id = _user_id
      AND role = _role
  )
$$;

-- Create function to check if user is assigned to an event
CREATE OR REPLACE FUNCTION public.is_assigned_to_event(_user_id UUID, _event_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.event_assignments ea
    JOIN public.staff s ON ea.staff_id = s.id
    WHERE ea.event_id = _event_id
      AND s.user_id = _user_id
  )
$$;

-- Handle new user registration
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, email, full_name)
  VALUES (NEW.id, NEW.email, NEW.raw_user_meta_data ->> 'full_name');
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Update timestamp function
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

-- Add update triggers
CREATE TRIGGER update_profiles_updated_at BEFORE UPDATE ON public.profiles FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_staff_updated_at BEFORE UPDATE ON public.staff FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_events_updated_at BEFORE UPDATE ON public.events FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_workflow_templates_updated_at BEFORE UPDATE ON public.workflow_templates FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_worksheets_updated_at BEFORE UPDATE ON public.worksheets FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_delivery_records_updated_at BEFORE UPDATE ON public.delivery_records FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- RLS Policies

-- Profiles: users can view all profiles, update own
CREATE POLICY "Users can view all profiles" ON public.profiles FOR SELECT TO authenticated USING (true);
CREATE POLICY "Users can update own profile" ON public.profiles FOR UPDATE TO authenticated USING (auth.uid() = id);

-- User roles: admins can manage, users can view own
CREATE POLICY "Users can view own roles" ON public.user_roles FOR SELECT TO authenticated USING (user_id = auth.uid());
CREATE POLICY "Admins can view all roles" ON public.user_roles FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins can manage roles" ON public.user_roles FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin'));

-- Staff: admins full access, photographers can view
CREATE POLICY "Admins can manage staff" ON public.staff FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Photographers can view staff" ON public.staff FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'photographer'));

-- Events: admins full access, photographers can view assigned events
CREATE POLICY "Admins can manage events" ON public.events FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Photographers can view assigned events" ON public.events FOR SELECT TO authenticated 
  USING (public.has_role(auth.uid(), 'photographer') AND public.is_assigned_to_event(auth.uid(), id));

-- Event assignments: admins full access, photographers can view own
CREATE POLICY "Admins can manage assignments" ON public.event_assignments FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Photographers can view own assignments" ON public.event_assignments FOR SELECT TO authenticated 
  USING (public.has_role(auth.uid(), 'photographer') AND EXISTS (
    SELECT 1 FROM public.staff s WHERE s.id = staff_id AND s.user_id = auth.uid()
  ));

-- Workflow templates: admins full access, photographers can view
CREATE POLICY "Admins can manage templates" ON public.workflow_templates FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Photographers can view templates" ON public.workflow_templates FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'photographer'));

-- Workflow template items: same as templates
CREATE POLICY "Admins can manage template items" ON public.workflow_template_items FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Photographers can view template items" ON public.workflow_template_items FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'photographer'));

-- Worksheets: admins full, photographers can view/update assigned event worksheets
CREATE POLICY "Admins can manage worksheets" ON public.worksheets FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Photographers can view assigned worksheets" ON public.worksheets FOR SELECT TO authenticated 
  USING (public.has_role(auth.uid(), 'photographer') AND public.is_assigned_to_event(auth.uid(), event_id));

-- Worksheet items: admins full, photographers can view/update on assigned events
CREATE POLICY "Admins can manage worksheet items" ON public.worksheet_items FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Photographers can view assigned worksheet items" ON public.worksheet_items FOR SELECT TO authenticated 
  USING (public.has_role(auth.uid(), 'photographer') AND EXISTS (
    SELECT 1 FROM public.worksheets w WHERE w.id = worksheet_id AND public.is_assigned_to_event(auth.uid(), w.event_id)
  ));
CREATE POLICY "Photographers can update assigned worksheet items" ON public.worksheet_items FOR UPDATE TO authenticated 
  USING (public.has_role(auth.uid(), 'photographer') AND EXISTS (
    SELECT 1 FROM public.worksheets w WHERE w.id = worksheet_id AND public.is_assigned_to_event(auth.uid(), w.event_id)
  ));

-- Delivery records: admins full, photographers can view assigned
CREATE POLICY "Admins can manage delivery records" ON public.delivery_records FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Photographers can view assigned delivery records" ON public.delivery_records FOR SELECT TO authenticated 
  USING (public.has_role(auth.uid(), 'photographer') AND public.is_assigned_to_event(auth.uid(), event_id));

-- Insert default workflow templates
INSERT INTO public.workflow_templates (template_name, phase) VALUES
  ('Pre-event Planning', 'pre_event'),
  ('Photographer Briefing', 'pre_event'),
  ('Day-of Logistics', 'day_of'),
  ('Equipment Checklist', 'day_of'),
  ('Coverage Plan', 'day_of'),
  ('Delivery Checklist', 'post_event'),
  ('Post-event Wrap-up', 'post_event');

-- Insert default template items
INSERT INTO public.workflow_template_items (template_id, item_text, sort_order)
SELECT t.id, items.item_text, items.sort_order
FROM public.workflow_templates t
CROSS JOIN LATERAL (
  VALUES
    ('Pre-event Planning', 'Confirm event details with client', 1),
    ('Pre-event Planning', 'Review venue layout and lighting', 2),
    ('Pre-event Planning', 'Confirm photographer assignments', 3),
    ('Pre-event Planning', 'Send calendar invites', 4),
    ('Photographer Briefing', 'Share shot list with team', 1),
    ('Photographer Briefing', 'Discuss client preferences', 2),
    ('Photographer Briefing', 'Review event timeline', 3),
    ('Day-of Logistics', 'Check weather conditions', 1),
    ('Day-of Logistics', 'Confirm travel arrangements', 2),
    ('Day-of Logistics', 'Contact onsite coordinator', 3),
    ('Equipment Checklist', 'Cameras and lenses', 1),
    ('Equipment Checklist', 'Memory cards', 2),
    ('Equipment Checklist', 'Batteries and chargers', 3),
    ('Equipment Checklist', 'Lighting equipment', 4),
    ('Equipment Checklist', 'Backup gear', 5),
    ('Coverage Plan', 'Arrival shots', 1),
    ('Coverage Plan', 'Key moments', 2),
    ('Coverage Plan', 'Group photos', 3),
    ('Coverage Plan', 'Candid moments', 4),
    ('Delivery Checklist', 'Cull and select photos', 1),
    ('Delivery Checklist', 'Edit selected photos', 2),
    ('Delivery Checklist', 'Upload to delivery platform', 3),
    ('Delivery Checklist', 'Generate QR codes', 4),
    ('Delivery Checklist', 'Send delivery link to client', 5),
    ('Post-event Wrap-up', 'Archive raw files', 1),
    ('Post-event Wrap-up', 'Update event status', 2),
    ('Post-event Wrap-up', 'Request client feedback', 3)
) AS items(template_name, item_text, sort_order)
WHERE t.template_name = items.template_name;