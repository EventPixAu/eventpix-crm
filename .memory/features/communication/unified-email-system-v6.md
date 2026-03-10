# Memory: features/communication/unified-email-system-v6
Updated: now

The unified email system uses a **hybrid Gmail/Resend architecture**:

**Gmail SMTP** (`pix@eventpix.com.au`) handles all 1:1 client and team communications via `npm:nodemailer@6`. Emails sent through Gmail appear in the Gmail Sent folder and thread naturally with client replies. Functions using Gmail: `send-crm-email`, `send-notification`, `send-recovery-email`, `send-quote-acceptance-email`, `process-event-date-reminders`, `admin-create-user`.

**Resend** (`pix@rs.eventpix.com.au`) is used exclusively for bulk email campaigns via `EmailCampaignManager`. The `resend-webhook` synchronizes Resend delivery events (Delivered, Bounced, Opened, Clicked) to the `email_logs` table for campaign tracking.

The CRM Emails dashboard includes a 'Sent' tab for tracking all outbound communications. The `send-crm-email` function includes an invisible tracking pixel for open tracking. Bounced statuses are prioritized to prevent overwriting by tracking pixel events.
