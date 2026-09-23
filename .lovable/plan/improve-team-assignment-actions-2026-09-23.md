# Improve team assignment actions

## Changes
- Record the latest date whenever an assignment notification is sent or resent.
- Show that date beside the **Resend** label on each team assignment.
- Move **Remove** to a separate row directly beneath the current action buttons.
- Constrain the pay details area to half the assignment card width on larger screens, while keeping it full width on small screens.

## Technical details
- Add a nullable notification timestamp to event assignments and update it only after a successful email send.
- Refresh assignment data after sending so the displayed date updates immediately.
- Preserve existing confirmation, removal, and pay calculation behavior.
