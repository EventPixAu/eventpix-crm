# Client delivery-options email

## What you will get
- A new editable **Booking confirmed – delivery options** email template, prepared for review after a proposal is converted to an event. Nothing sends automatically.
- The event name and date, confirmation of standard Dropbox delivery, and the supplied **Client_delivery_options.docx** attached to the email.
- A **Choose delivery option** button opening a simple client form, without requiring sign-in.
- Four choices matching your document: Dropbox only, post-event guest gallery, facial recognition private, or facial recognition public. Facial recognition selections also ask immediate or delayed delivery; optional social media manager access and branding notes are included.
- A **Confirm delivery choice** action that saves the response and displays it on the event, with a confirmation date.
- A **Send delivery options** action on the event so you can review, send or resend later. Sent emails stay in that job’s Mail History.

## Technical details
- Use the existing editable email templates, review window and Gmail sender, including its attachment support and unresolved-placeholder checks.
- Store the uploaded document through the project asset flow and load it as a required attachment before sending; do not send if it cannot be attached.
- Add a dedicated, expiring event-specific response token and server-validated public form. Opening the email link never changes the choice; only explicit confirmation saves it.
- Save the client preference separately from operational delivery settings so a client response does not silently change production configuration.
- Verify prepared email, attachment, invalid-link handling and client response flow without sending test emails to real clients.