---
name: Staff Role Onsite Flag
description: staff_roles.is_onsite distinguishes call-sheet/billable roles from post-production workflow-only roles
type: feature
---

`staff_roles.is_onsite` (bool, default true) separates onsite event-day roles from post-production / workflow-only roles.

- **Onsite (true)** — Photographer, Videographer, Assistant, Editor - Onsite. Appear in Payment panel pay calc, call sheets, and event-day documents.
- **Off-site (false)** — Editor - LBA/SBC, Editor - Post, Editor - SMP Live, Editor - Video, Editor - Zno Gallery, Editor - Zno Live, Retouchers. Assignable to events for workflow/queue tracking, but excluded from per-event pay calc and crew-facing comms.

Aligns with existing Offsite Personnel Roles rule (editors/retouchers excluded from client-facing communications).

Admin: Lookups > Staff Roles tab has an "Onsite" toggle column.
Payment panel filter: `EventPaymentPanel.tsx` builds `offsiteRoleIds` Set from `useStaffRoles()` and skips assignments where `staff_role_id` is in the set.
