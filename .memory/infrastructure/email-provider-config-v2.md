# Memory: infrastructure/email-provider-config-v2
Updated: now

## Hybrid Email Architecture

**Gmail SMTP** (pix@eventpix.com.au via Google Workspace + App Password) is used for all client-facing and team communications:
- `send-crm-email` — manual CRM emails to clients/contacts
- `send-notification` — crew assignment & event update notifications
- `send-recovery-email` — password recovery emails
- `send-quote-acceptance-email` — quote acceptance confirmations (client + internal)
- `process-event-date-reminders` — automated event date staff reminders
- `admin-create-user` — team invitation and access emails

All these functions use `npm:nodemailer@6` with Gmail SMTP (smtp.gmail.com:465, TLS). The sender is `"EventPix" <pix@eventpix.com.au>`. Emails appear in the Gmail Sent folder and thread naturally with client replies.

**Resend** (pix@rs.eventpix.com.au) is retained for:
- Bulk email campaigns via `EmailCampaignManager`
- The `resend-webhook` function for delivery/open/click tracking from Resend

**Secrets:**
- `GMAIL_APP_PASSWORD` — Google Workspace App Password for pix@eventpix.com.au
- `RESEND_API_KEY` — retained for campaign/bulk sends only

**Tracking:** The tracking pixel in `send-crm-email` still works via the `email-tracking-pixel` edge function. Resend webhook events only apply to campaign emails sent through Resend.
