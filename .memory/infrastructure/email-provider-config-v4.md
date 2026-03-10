# Memory: infrastructure/email-provider-config-v4
Updated: now

## Hybrid Email Architecture

**Gmail OAuth2** (pix@eventpix.com.au via Google Workspace + OAuth2 Client Credentials) is used for all client-facing and team communications:
- `send-crm-email` — manual CRM emails to clients/contacts
- `send-notification` — crew assignment & event update notifications (with .ics attachments)
- `send-recovery-email` — password recovery emails
- `send-quote-acceptance-email` — quote acceptance confirmations (client + internal)
- `process-event-date-reminders` — automated event date staff reminders
- `admin-create-user` — team invitation and access emails

All these functions use `npm:nodemailer@6` with Gmail SMTP (smtp.gmail.com:465, TLS) and **OAuth2 authentication** (not App Password). Nodemailer handles access token refresh automatically using the refresh token. The sender is `"EventPix" <pix@eventpix.com.au>`.

**Resend** (pix@rs.eventpix.com.au) is retained for:
- Bulk email campaigns via `EmailCampaignManager`
- The `resend-webhook` function for delivery/open/click tracking from Resend

**Secrets:**
- `GMAIL_CLIENT_ID` — Google OAuth2 Client ID (Web application type)
- `GMAIL_CLIENT_SECRET` — Google OAuth2 Client Secret
- `GMAIL_REFRESH_TOKEN` — OAuth2 Refresh Token for pix@eventpix.com.au (scope: gmail.send)
- `RESEND_API_KEY` — retained for campaign/bulk sends only
- `GMAIL_APP_PASSWORD` — deprecated, can be removed

**Tracking:** The tracking pixel in `send-crm-email` still works via the `email-tracking-pixel` edge function. Resend webhook events only apply to campaign emails sent through Resend.
