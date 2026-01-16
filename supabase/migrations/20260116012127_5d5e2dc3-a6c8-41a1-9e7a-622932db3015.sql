-- =====================================================
-- SEED DATA FOR GO-LIVE READINESS
-- Idempotent - uses ON CONFLICT to avoid duplicates
-- =====================================================

-- 1. PRODUCT CATEGORIES (if not exist)
INSERT INTO public.product_categories (id, name, description, sort_order, is_active)
VALUES 
  ('11111111-0001-0001-0001-000000000001', 'Event Coverage', 'Photography and videography coverage services', 1, true),
  ('11111111-0001-0001-0001-000000000002', 'Add-Ons', 'Additional services and enhancements', 2, true),
  ('11111111-0001-0001-0001-000000000003', 'Delivery Options', 'Delivery and turnaround options', 3, true)
ON CONFLICT (id) DO NOTHING;

-- 2. PRODUCTS (Seed defaults)
INSERT INTO public.products (id, category_id, name, description, unit_price, tax_rate, is_active)
VALUES 
  ('22222222-0001-0001-0001-000000000001', '11111111-0001-0001-0001-000000000001', 
   'Corporate Event Coverage – Half Day', 
   'Professional photography coverage for up to 4 hours including editing and delivery of high-resolution images.', 
   1500.00, 0.10, true),
  
  ('22222222-0001-0001-0001-000000000002', '11111111-0001-0001-0001-000000000001', 
   'Corporate Event Coverage – Full Day', 
   'Professional photography coverage for up to 8 hours including editing and delivery of high-resolution images.', 
   2500.00, 0.10, true),
  
  ('22222222-0001-0001-0001-000000000003', '11111111-0001-0001-0001-000000000001', 
   'Awards Night Coverage', 
   'Comprehensive awards ceremony photography including VIP arrivals, stage coverage, and winner portraits.', 
   3500.00, 0.10, true),
  
  ('22222222-0001-0001-0001-000000000004', '11111111-0001-0001-0001-000000000002', 
   'Additional Photographer (Hourly)', 
   'Add an extra photographer to your event for broader coverage.', 
   150.00, 0.10, true),
  
  ('22222222-0001-0001-0001-000000000005', '11111111-0001-0001-0001-000000000002', 
   'Videography Add-On', 
   'Professional videography coverage with edited highlight reel.', 
   2000.00, 0.10, true),
  
  ('22222222-0001-0001-0001-000000000006', '11111111-0001-0001-0001-000000000003', 
   'Express Delivery', 
   'Priority processing with delivery within 48 hours of event completion.', 
   500.00, 0.10, true)
ON CONFLICT (id) DO NOTHING;

-- 3. QUOTE TEMPLATES (Content blocks)
INSERT INTO public.quote_templates (id, name, description, terms_text, items_json, is_active)
VALUES 
  ('33333333-0001-0001-0001-000000000001', 
   'Corporate Half-Day Package', 
   'Standard package for corporate events up to 4 hours',
   E'Payment Terms:\n- 50% deposit required upon booking confirmation\n- Remaining balance due within 7 days of event\n\nDelivery:\n- Edited images delivered within 5 business days\n- Online gallery access for 30 days\n- High-resolution downloads included\n\nInclusions:\n- Professional editing and colour correction\n- Private online gallery\n- Usage rights for corporate purposes',
   '[{"description": "Corporate Event Coverage – Half Day", "quantity": 1, "unit_price": 1500, "tax_rate": 0.1}]'::jsonb,
   true),
   
  ('33333333-0001-0001-0001-000000000002', 
   'Corporate Full-Day Package', 
   'Comprehensive package for full-day corporate events',
   E'Payment Terms:\n- 50% deposit required upon booking confirmation\n- Remaining balance due within 7 days of event\n\nDelivery:\n- Edited images delivered within 5 business days\n- Online gallery access for 30 days\n- High-resolution downloads included\n\nInclusions:\n- Professional editing and colour correction\n- Private online gallery\n- Usage rights for corporate purposes',
   '[{"description": "Corporate Event Coverage – Full Day", "quantity": 1, "unit_price": 2500, "tax_rate": 0.1}]'::jsonb,
   true),

  ('33333333-0001-0001-0001-000000000003', 
   'Awards Night Package', 
   'Premium package for awards ceremonies and gala events',
   E'Payment Terms:\n- 50% deposit required upon booking confirmation\n- Remaining balance due within 7 days of event\n\nDelivery:\n- Express edited images (winner portraits) within 24 hours\n- Full gallery delivered within 5 business days\n- Online gallery access for 60 days\n\nInclusions:\n- Red carpet/arrival coverage\n- Stage and ceremony photography\n- Winner portrait sessions\n- Professional editing and retouching\n- Usage rights for promotional purposes',
   '[{"description": "Awards Night Coverage", "quantity": 1, "unit_price": 3500, "tax_rate": 0.1}, {"description": "Express Delivery", "quantity": 1, "unit_price": 500, "tax_rate": 0.1}]'::jsonb,
   true)
ON CONFLICT (id) DO NOTHING;

-- 4. CONTRACT TEMPLATES
INSERT INTO public.contract_templates (id, name, body_html, is_active)
VALUES 
  ('44444444-0001-0001-0001-000000000001', 
   'Standard Corporate Event Contract',
   E'<div style="font-family: Arial, sans-serif; max-width: 800px; margin: 0 auto; padding: 20px;">
<h1 style="text-align: center; color: #333;">Photography Services Agreement</h1>

<p><strong>Client:</strong> {{client.business_name}}<br/>
<strong>Contact:</strong> {{client.primary_contact_name}}<br/>
<strong>Date:</strong> {{contract.created_date}}</p>

<h2>Event Details</h2>
<p><strong>Event:</strong> {{event.event_name}}<br/>
<strong>Date:</strong> {{event.event_date}}<br/>
<strong>Venue:</strong> {{event.venue_name}}, {{event.venue_address}}<br/>
<strong>Coverage Time:</strong> {{event.start_time}} - {{event.end_time}}</p>

<h2>Services</h2>
<p>Eventpix will provide professional photography services as outlined in the associated quote. Services include:</p>
<ul>
<li>Professional photographer(s) for the duration specified</li>
<li>Professional editing and colour correction</li>
<li>High-resolution digital images via online gallery</li>
<li>Usage rights for corporate/promotional purposes</li>
</ul>

<h2>Payment Terms</h2>
<p>A 50% deposit is required to secure the booking. The remaining balance is due within 7 days of the event date.</p>

<h2>Cancellation Policy</h2>
<ul>
<li>More than 14 days notice: Full refund of deposit</li>
<li>7-14 days notice: 50% of deposit retained</li>
<li>Less than 7 days notice: Full deposit retained</li>
</ul>

<h2>Agreement</h2>
<p>By signing below, both parties agree to the terms outlined in this contract and the associated quote.</p>

<div style="margin-top: 40px; border-top: 1px solid #ccc; padding-top: 20px;">
<p><strong>Accepted by:</strong> ____________________</p>
<p><strong>Date:</strong> ____________________</p>
</div>
</div>',
   true),

  ('44444444-0001-0001-0001-000000000002', 
   'National Program Contract',
   E'<div style="font-family: Arial, sans-serif; max-width: 800px; margin: 0 auto; padding: 20px;">
<h1 style="text-align: center; color: #333;">National Program Photography Agreement</h1>

<p><strong>Program Partner:</strong> {{client.business_name}}<br/>
<strong>Primary Contact:</strong> {{client.primary_contact_name}}<br/>
<strong>Agreement Date:</strong> {{contract.created_date}}</p>

<h2>Program Overview</h2>
<p>This agreement covers photography services for a series of events under the national program. Each individual event will be scheduled and confirmed separately under this master agreement.</p>

<h2>Scope of Services</h2>
<ul>
<li>Professional photography coverage at each program event</li>
<li>Consistent brand styling across all deliverables</li>
<li>Dedicated account management</li>
<li>Priority scheduling for program events</li>
<li>Centralised delivery portal</li>
</ul>

<h2>Pricing Structure</h2>
<p>Pricing for each event is as per the program rate card attached to this agreement. Volume discounts apply as follows:</p>
<ul>
<li>5-9 events: 5% discount</li>
<li>10-19 events: 10% discount</li>
<li>20+ events: 15% discount</li>
</ul>

<h2>Delivery Standards</h2>
<ul>
<li>Edited images delivered within 5 business days of each event</li>
<li>Express delivery available for key events (additional fee applies)</li>
<li>All images delivered via secure online gallery</li>
</ul>

<h2>Term and Renewal</h2>
<p>This agreement is valid for 12 months from the date of signing and may be renewed by mutual agreement.</p>

<div style="margin-top: 40px; border-top: 1px solid #ccc; padding-top: 20px;">
<p><strong>Authorised Signatory:</strong> ____________________</p>
<p><strong>Position:</strong> ____________________</p>
<p><strong>Date:</strong> ____________________</p>
</div>
</div>',
   true)
ON CONFLICT (id) DO NOTHING;

-- 5. EVENT SERIES TEMPLATE (Local Business Awards)
INSERT INTO public.event_series (id, name, event_type_id, default_coverage_details, default_delivery_deadline_days, default_notes_public, default_notes_internal, default_venue_city, is_active)
VALUES 
  ('55555555-0001-0001-0001-000000000001',
   'Local Business Awards 2025',
   (SELECT id FROM public.event_types WHERE name ILIKE '%awards%' OR name ILIKE '%corporate%' LIMIT 1),
   'Full awards ceremony coverage including arrivals, stage photography, winner portraits, and networking.',
   5,
   'Please arrive 15 minutes before your scheduled time. Dress code is business formal. Winner portraits will be taken immediately after receiving your award.',
   'Standard LBA setup. Check regional coordinator contact before event. Ensure backdrop and lighting equipment is confirmed with venue.',
   NULL,
   true)
ON CONFLICT (id) DO NOTHING;

-- 6. Add is_training flag to key tables for identifying training data
ALTER TABLE public.clients ADD COLUMN IF NOT EXISTS is_training BOOLEAN DEFAULT false;
ALTER TABLE public.leads ADD COLUMN IF NOT EXISTS is_training BOOLEAN DEFAULT false;
ALTER TABLE public.events ADD COLUMN IF NOT EXISTS is_training BOOLEAN DEFAULT false;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS is_training BOOLEAN DEFAULT false;

-- 7. Add indexes for filtering training data
CREATE INDEX IF NOT EXISTS idx_clients_is_training ON public.clients(is_training) WHERE is_training = true;
CREATE INDEX IF NOT EXISTS idx_leads_is_training ON public.leads(is_training) WHERE is_training = true;
CREATE INDEX IF NOT EXISTS idx_events_is_training ON public.events(is_training) WHERE is_training = true;
CREATE INDEX IF NOT EXISTS idx_profiles_is_training ON public.profiles(is_training) WHERE is_training = true;