-- Phase 1: Core Data Model Fixes

-- 1. EVENT SESSIONS TABLE
-- Supports multi-day and multi-session jobs for both Leads and Events
CREATE TABLE public.event_sessions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  lead_id UUID REFERENCES public.leads(id) ON DELETE CASCADE,
  event_id UUID REFERENCES public.events(id) ON DELETE CASCADE,
  session_date DATE NOT NULL,
  start_time TIME,
  end_time TIME,
  label TEXT,
  venue_name TEXT,
  venue_address TEXT,
  notes TEXT,
  sort_order INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  
  -- Constraint: exactly one of lead_id or event_id must be set
  CONSTRAINT event_sessions_parent_check CHECK (
    (lead_id IS NOT NULL AND event_id IS NULL) OR 
    (lead_id IS NULL AND event_id IS NOT NULL)
  )
);

-- Create indexes for efficient queries
CREATE INDEX idx_event_sessions_lead_id ON public.event_sessions(lead_id);
CREATE INDEX idx_event_sessions_event_id ON public.event_sessions(event_id);
CREATE INDEX idx_event_sessions_session_date ON public.event_sessions(session_date);

-- Enable RLS
ALTER TABLE public.event_sessions ENABLE ROW LEVEL SECURITY;

-- RLS Policies for event_sessions
CREATE POLICY "Admins can manage all sessions"
  ON public.event_sessions FOR ALL
  USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Sales can manage lead sessions"
  ON public.event_sessions FOR ALL
  USING (public.can_access_sales(auth.uid()));

CREATE POLICY "Staff can view their assigned event sessions"
  ON public.event_sessions FOR SELECT
  USING (
    event_id IN (
      SELECT event_id FROM public.event_assignments WHERE user_id = auth.uid()
    )
  );

-- 2. UPDATE CLIENT_CONTACTS TABLE
-- Add phone_mobile, phone_office, role_title fields
ALTER TABLE public.client_contacts 
  ADD COLUMN IF NOT EXISTS phone_mobile TEXT,
  ADD COLUMN IF NOT EXISTS phone_office TEXT,
  ADD COLUMN IF NOT EXISTS role_title TEXT;

-- 3. EVENT_CONTACTS TABLE
-- Supports multiple contacts per event with different types
CREATE TABLE public.event_contacts (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  event_id UUID NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
  client_contact_id UUID REFERENCES public.client_contacts(id) ON DELETE SET NULL,
  contact_type TEXT NOT NULL DEFAULT 'primary' CHECK (contact_type IN ('primary', 'onsite', 'social_media', 'other')),
  contact_name TEXT,
  contact_phone TEXT,
  contact_email TEXT,
  notes TEXT,
  sort_order INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Create indexes
CREATE INDEX idx_event_contacts_event_id ON public.event_contacts(event_id);
CREATE INDEX idx_event_contacts_client_contact_id ON public.event_contacts(client_contact_id);

-- Enable RLS
ALTER TABLE public.event_contacts ENABLE ROW LEVEL SECURITY;

-- RLS Policies for event_contacts
CREATE POLICY "Admins can manage all event contacts"
  ON public.event_contacts FOR ALL
  USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Sales can manage event contacts"
  ON public.event_contacts FOR ALL
  USING (public.can_access_sales(auth.uid()));

CREATE POLICY "Staff can view contacts for their assigned events"
  ON public.event_contacts FOR SELECT
  USING (
    event_id IN (
      SELECT event_id FROM public.event_assignments WHERE user_id = auth.uid()
    )
  );

-- Update timestamp trigger for event_sessions
CREATE TRIGGER update_event_sessions_updated_at
  BEFORE UPDATE ON public.event_sessions
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();