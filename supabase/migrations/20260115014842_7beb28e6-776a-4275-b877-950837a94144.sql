-- Job Intake table for sales-to-operations handoff
CREATE TABLE public.job_intake (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  source text NOT NULL DEFAULT 'studio_ninja',
  external_job_id text,
  client_name text NOT NULL,
  client_email text,
  job_name text NOT NULL,
  proposed_event_date date,
  status text NOT NULL DEFAULT 'proposed' CHECK (status IN ('proposed', 'accepted', 'cancelled')),
  notes text,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  converted_at timestamp with time zone,
  converted_by uuid REFERENCES public.profiles(id)
);

-- Knowledge Base table for photographer wiki
CREATE TABLE public.knowledge_base (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  category text NOT NULL,
  content text NOT NULL,
  is_active boolean DEFAULT true,
  sort_order integer DEFAULT 0,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  created_by uuid REFERENCES public.profiles(id)
);

-- Add fields to events table
ALTER TABLE public.events
ADD COLUMN job_intake_id uuid REFERENCES public.job_intake(id),
ADD COLUMN invoice_status text DEFAULT 'not_invoiced' CHECK (invoice_status IN ('not_invoiced', 'invoiced', 'paid')),
ADD COLUMN invoice_reference text,
ADD COLUMN ops_status text DEFAULT 'awaiting_details' CHECK (ops_status IN ('awaiting_details', 'ready', 'in_progress', 'delivered', 'closed'));

-- Enable RLS
ALTER TABLE public.job_intake ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.knowledge_base ENABLE ROW LEVEL SECURITY;

-- Job Intake policies (admin only)
CREATE POLICY "Admins can manage job_intake"
ON public.job_intake FOR ALL
USING (has_role(auth.uid(), 'admin'));

-- Knowledge Base policies
CREATE POLICY "Admins can manage knowledge_base"
ON public.knowledge_base FOR ALL
USING (has_role(auth.uid(), 'admin'));

CREATE POLICY "Authenticated can read active knowledge_base"
ON public.knowledge_base FOR SELECT
USING (is_active = true);

-- Seed knowledge base categories
INSERT INTO public.knowledge_base (title, category, content, sort_order) VALUES
('Camera Settings for Corporate Events', 'Camera settings', '# Camera Settings Guide

## Indoor Corporate Events
- ISO: 800-3200 depending on lighting
- Aperture: f/2.8-4.0 for group shots, f/1.8-2.8 for portraits
- Shutter: 1/125 minimum for handheld

## Outdoor Events
- ISO: 100-400
- Aperture: f/5.6-8 for groups
- Use ND filters in bright conditions', 1),

('Lighting Setup Basics', 'Lighting setups', '# Lighting Fundamentals

## On-Camera Flash
- Bounce when possible
- Use diffuser for direct flash
- -1 to -2 EV compensation for fill

## Portable Lighting
- Position 45 degrees from subject
- Use reflector for fill
- Test before event starts', 2),

('Corporate Event Etiquette', 'Corporate etiquette', '# Professional Conduct

## Before the Event
- Arrive 30 minutes early
- Introduce yourself to key contacts
- Review shot list with organizer

## During the Event
- Be unobtrusive during speeches
- Ask permission for posed shots
- Dress appropriately for venue', 3),

('File Handling Procedures', 'File handling', '# File Management

## On-Site
- Dual card recording when possible
- Never format cards until backup confirmed
- Label cards with event name/date

## Post-Event
- Import to designated folder structure
- Verify file count matches
- Create immediate backup', 4),

('Delivery Procedures', 'Delivery procedures', '# Delivery Guidelines

## Timeline
- Same-day delivery: Within 4 hours of event end
- Standard delivery: Within 5 business days
- Check event-specific deadlines

## Quality Control
- Review all images before delivery
- Apply consistent editing
- Verify link access before sending', 5),

('Frequently Asked Questions', 'FAQs', '# Common Questions

## Equipment
**Q: What backup do I bring?**
A: Second body, extra batteries, multiple cards

## Client Requests
**Q: Can clients request specific shots?**
A: Yes, coordinate through admin before event

## Issues
**Q: What if I encounter a problem on-site?**
A: Contact admin immediately via phone', 6);

-- Add updated_at trigger for new tables
CREATE TRIGGER update_job_intake_updated_at
BEFORE UPDATE ON public.job_intake
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_knowledge_base_updated_at
BEFORE UPDATE ON public.knowledge_base
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();