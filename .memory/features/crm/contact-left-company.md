---
name: Left Company Contact Status
description: "Left Company" contact status unlinks the contact from all companies and archives them.
type: feature
---
Status option `Left Company` exists alongside the 7 standard contact statuses.

Selecting it on the contact detail page prompts for confirmation and calls
`public.mark_contact_left_company(p_contact_id)`, which:
- deactivates all `contact_company_associations` rows,
- clears `client_contacts.client_id` and `is_primary`,
- sets `status = 'Left Company'`, `archived = true`, `archived_at = now()`.

Automatic status logic never overwrites `Left Company`:
`refresh_contact_status` and `apply_inherited_status_to_contact` return early for it;
`contact_status_priority('Left Company') = 1` (same as Archived).

Campaigns exclude `Left Company` by default (like Staff/Archived).
