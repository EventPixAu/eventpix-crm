
UPDATE public.email_templates
SET
  subject = 'Your event is confirmed — welcome to Eventpixii! 🎉',
  body_html = $HTML$<p>Hi {{client.first_name}},</p>
<p><strong>Great news — your event is confirmed!</strong> 🎉</p>
<p>Here are your booking details:</p>
<p><strong>Event:</strong> {{event.event_name}}<br/>
<strong>Client:</strong> {{client.business_name}}</p>
<p><strong>Welcome to Eventpixii!</strong></p>
<p>From here, everything for your event is managed through your personal <strong>Client Portal</strong>. This is your one-stop hub where you can:</p>
<ul>
  <li>View your event details and status updates</li>
  <li>View details of your photographer and other team members assigned to your event</li>
  <li>Access important documents such as your budget and agreement</li>
  <li>Access links to your galleries</li>
  <li>Stay up to date as your event progresses</li>
</ul>
<p><strong>Your Client Portal Link:</strong><br/>
<a href="{{event.portal_url}}" style="display:inline-block;padding:12px 24px;background-color:#000;color:#fff;text-decoration:none;border-radius:6px;font-weight:500;margin-top:8px;">Access Your Client Portal</a></p>
<p><strong>⭐ Important — please save this link!</strong><br/>
We recommend bookmarking it in your browser or saving it somewhere handy. This is the link you'll use to check in on your event at any time — all updates will be posted there so you're always in the loop.</p>
<p>We're excited to be part of your event and we'll be in touch as things progress. In the meantime, if you have any questions, just reply to this email.</p>
<p>Cheers,<br/>The Eventpixii Team</p>$HTML$,
  body_text = $TXT$Hi {{client.first_name}},

Great news — your event is confirmed! 🎉

Here are your booking details:

Event: {{event.event_name}}
Client: {{client.business_name}}

Welcome to Eventpixii!

From here, everything for your event is managed through your personal Client Portal. This is your one-stop hub where you can:

• View your event details and status updates
• View details of your photographer and other team members assigned to your event
• Access important documents such as your budget and agreement
• Access links to your galleries
• Stay up to date as your event progresses

Your Client Portal Link:
{{event.portal_url}}

⭐ Important — please save this link!
We recommend bookmarking it in your browser or saving it somewhere handy. This is the link you'll use to check in on your event at any time — all updates will be posted there so you're always in the loop.

We're excited to be part of your event and we'll be in touch as things progress. In the meantime, if you have any questions, just reply to this email.

Cheers,
The Eventpixii Team$TXT$,
  updated_at = now()
WHERE trigger_type = 'booking_confirmed';
