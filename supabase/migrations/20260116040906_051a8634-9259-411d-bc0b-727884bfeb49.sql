-- Phase 3.0: Add venue access and parking notes to events
ALTER TABLE public.events 
ADD COLUMN IF NOT EXISTS venue_access_notes TEXT,
ADD COLUMN IF NOT EXISTS venue_parking_notes TEXT;

-- Phase 3.3: Compliance Simplification
-- Set all compliance items as optional (required = false)
UPDATE public.compliance_document_types SET required = false WHERE required = true;

-- Deactivate Equipment Agreement (id: 44f00e92-5108-4fdd-a23a-07d5349a9562)
UPDATE public.compliance_document_types SET is_active = false WHERE id = '44f00e92-5108-4fdd-a23a-07d5349a9562';

-- Add Venue Inductions compliance item
INSERT INTO public.compliance_document_types (name, description, required, has_expiry, is_active, sort_order)
VALUES ('Venue Inductions', 'Completed venue-specific safety and access inductions', false, true, true, 8)
ON CONFLICT DO NOTHING;

-- Phase 3.4: Ensure email templates have ops trigger types
-- Add new email trigger types for ops communications
-- First check if we need to alter the enum (this is a safe addition)
DO $$
BEGIN
  -- Check if values exist, if not add them
  IF NOT EXISTS (SELECT 1 FROM pg_enum WHERE enumlabel = 'photographer_assignment' AND enumtypid = (SELECT oid FROM pg_type WHERE typname = 'email_trigger_type')) THEN
    ALTER TYPE email_trigger_type ADD VALUE IF NOT EXISTS 'photographer_assignment';
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_enum WHERE enumlabel = 'event_update' AND enumtypid = (SELECT oid FROM pg_type WHERE typname = 'email_trigger_type')) THEN
    ALTER TYPE email_trigger_type ADD VALUE IF NOT EXISTS 'event_update';
  END IF;
END $$;

-- Insert default ops email templates if they don't exist
INSERT INTO public.email_templates (name, subject, body_html, trigger_type, is_active)
VALUES 
  (
    'Event Confirmation to Client',
    'Your Event Booking Confirmation - {{event_name}}',
    '<h1>Booking Confirmed</h1><p>Dear {{client_name}},</p><p>We are pleased to confirm your booking for <strong>{{event_name}}</strong> on <strong>{{event_date}}</strong>.</p><p>Venue: {{venue_name}}<br/>{{venue_address}}</p><p>We look forward to capturing your special moments!</p>',
    'booking_confirmed',
    true
  ),
  (
    'Photographer Assignment Notification',
    'You have been assigned to: {{event_name}}',
    '<h1>New Assignment</h1><p>Hi {{photographer_name}},</p><p>You have been assigned to <strong>{{event_name}}</strong>.</p><p><strong>Date:</strong> {{event_date}}<br/><strong>Time:</strong> {{start_time}} - {{end_time}}<br/><strong>Venue:</strong> {{venue_name}}, {{venue_address}}</p><p>Please confirm your availability.</p>',
    'manual',
    true
  ),
  (
    'Event Update Notification',
    'Event Update: {{event_name}}',
    '<h1>Event Details Updated</h1><p>The details for <strong>{{event_name}}</strong> have been updated.</p><p>Please review the latest information in your dashboard.</p>',
    'manual',
    true
  )
ON CONFLICT DO NOTHING;