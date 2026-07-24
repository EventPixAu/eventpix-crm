INSERT INTO public.contract_templates (name, body_html, is_active, format)
SELECT
  'Series Agreement (multi-event)',
  $html$
<h1>Event Services Agreement — {{series_name}}</h1>
<p>This agreement is made between <strong>Eventpix</strong> ("the Photographer") and the Client for the delivery of photography and related services across the {{event_count}} events listed below (collectively, "the Series").</p>

<h2>Events covered</h2>
{{events_table}}

<h2>Fees</h2>
<p>The agreed fee is <strong>{{per_event_fee}} per event</strong>. Fees marked "per event" in the accompanying budget apply to each scheduled event in the Series. Any additional services requested for a specific event will be quoted separately as an addendum to this agreement and are not included in the amounts below.</p>
<ul>
  <li>Per-event services subtotal ({{event_count}} events): <strong>{{per_event_total}}</strong></li>
  <li>One-off / flat charges: <strong>{{flat_total}}</strong></li>
  <li><strong>Total Series fee: {{grand_total}}</strong></li>
</ul>

<h2>Additions and changes</h2>
<p>The Client may request additional services (e.g. extra hours, additional shooters, extra edited images, prints, or extra deliverables) for any individual event in the Series. Such additions will be documented as an addendum quote and, once accepted by the Client, will be invoiced in addition to the amounts above.</p>

<h2>Cancellation of individual events</h2>
<p>If an individual event in the Series is cancelled with more than 14 days' notice, the per-event fee for that event will not be charged. Cancellations within 14 days of the event will be charged in full. Flat / one-off charges are non-refundable once work has commenced.</p>

<h2>Acceptance</h2>
<p>By signing this agreement, the Client accepts these terms for all {{event_count}} events in the Series.</p>
  $html$,
  true,
  'html'
WHERE NOT EXISTS (
  SELECT 1 FROM public.contract_templates WHERE name = 'Series Agreement (multi-event)'
);