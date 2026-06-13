---
name: Contact Status Automation
description: Auto-assigns 'Active' CRM contact status from open leads/active events. Protects Staff/Archived/Old.
type: feature
---
Contact statuses (order): Active, Current, Previous, Old, Prospect, Staff, Archived.

`public.refresh_contact_status(p_contact_id)` sets:
- `Active` if any of: enquiry_contacts→lead (status NOT IN won/lost), contact_company_associations→leads (open), contact_company_associations→events (ops_status NOT IN completed/delivered/archived/cancelled), event_contacts→events (active).
- Reverts Active → Current (last event ≤12mo) or Previous (older) when no longer active.
- NEVER modifies contacts with status Staff, Archived, or Old.

Triggers calling it:
- `leads_refresh_contact_status` on leads (status, client_id; also iterates enquiry_contacts for that lead)
- `events_refresh_contact_status` on events (ops_status, client_id, event_date; iterates event_contacts)
- `event_contacts_refresh_status` on event_contacts
- `enquiry_contacts_refresh_status` on enquiry_contacts (direct lead↔contact links)
- `cca_refresh_status` on contact_company_associations

CSV import (UpdateContactsCsvDialog) protects existing Active, Current, and Staff contacts from status overwrite; counted as `statusProtected`.

Staff exclusions in UI:
- CampaignWizardDialog: when no status filter selected, query excludes status='Staff'.
- PromotionsDashboard: categoryCounts and dataHealth computed from `clientContacts = allContacts.filter(c => c.status !== 'Staff')`. Staff still appears as its own bucket in statusCounts.
