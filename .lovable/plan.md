# Crew SMS reminders

Use your existing ClickSend account with **EventPix** as the sender.

- Send confirmed onsite team members an event reminder **24 hours before setup**.
- Send them a delivery reminder **at event finish**, pointing them to their job sheet for upload instructions.
- Use each event’s local timezone. For multi-session jobs, use each assigned session’s crew call and finish times; for single-session jobs, prefer the event’s Setup time.
- Exclude cancelled events, declined/pending assignments, offsite team members and missing mobile numbers. Do not send historical reminders when switching this on.
- Prevent duplicate sends and record successful and failed attempts. Recheck current assignments and times before sending so edits and cancellations are respected.

## Timing and costs
Check once per minute, up to **1,440 checks per day**, to send within approximately one minute of the requested time. This can increase Lovable Cloud running costs; ClickSend charges come from your existing account balance. Checking less often costs less but delays reminders.

## Technical details
Add a protected reminder log and a dedicated scheduled sender, with automated tests for the 24-hour rule, finish-time rule, local timezones, cancellations and duplicate protection. Verify the ClickSend credentials without texting real crew during testing, then activate the schedule.