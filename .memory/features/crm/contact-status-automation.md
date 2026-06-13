---
name: Contact Status Automation
description: Auto-assigns 'Active' CRM contact status based on linked open leads/active events; reverts to Current/Previous on close
type: feature
---
Contact statuses: Active, Current, Previous, Old, Prospect, Archived (in priority order).

DB triggers on leads, events, event_contacts, contact_company_associations call `public.refresh_contact_status(contact_id)`:
- Sets status = 'Active' if any linked open lead (status NOT in won/lost) OR any linked active event (ops_status NOT in completed/delivered/archived/cancelled). Linkage = contact_company_associations OR event_contacts.client_contact_id.
- When no longer active AND status was previously 'Active', reverts to 'Current' (last event within 12 months) or 'Previous' (older).
- Never modifies contacts with status 'Old' or 'Archived'. Never touches 'Prospect'/'Previous'/blank unless promoting them to 'Active'.

CSV Update tool (UpdateContactsCsvDialog) protects existing 'Active' and 'Current' contacts from status overwrite, counted as `statusProtected` in the import summary.
