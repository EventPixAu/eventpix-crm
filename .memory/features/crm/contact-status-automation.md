---
name: Contact Status Automation
description: Auto-assigns CRM contact status from open leads/active events AND inherits from linked company status.
type: feature
---
Contact statuses (priority order, highest→lowest): Active > Current > Previous > Old > Prospect > Staff > Archived.

## Auto-assignment from leads/events
`public.refresh_contact_status(p_contact_id)` sets:
- `Active` if any of: enquiry_contacts→lead (status NOT IN won/lost), contact_company_associations→leads (open), contact_company_associations→events (ops_status NOT IN completed/delivered/archived/cancelled), event_contacts→events (active).
- Reverts Active → Current (last event ≤12mo) or Previous (older) when no longer active.
- NEVER modifies contacts with status Staff, Archived, or Old.

Triggers calling it: `leads_refresh_contact_status`, `events_refresh_contact_status`, `event_contacts_refresh_status`, `enquiry_contacts_refresh_status`, `cca_refresh_status`.

## Inheritance from company status (priority-based)
`public.apply_inherited_status_to_contact(p_contact_id)` resolves the contact's highest-priority status from ALL linked companies (direct client_id + active contact_company_associations) using `map_company_status_to_contact_status()`:
- active / active_event → Active
- current_client / current → Current
- previous_client → Previous
- inactive / x_inactive / lost → Old
- prospect → Prospect
- archived → Archived; staff → Staff
- (epx_supplier and unknown → no inheritance)

Only overwrites the contact's status if the inherited status has STRICTLY HIGHER priority than the current one, OR the current status is null/blank. Never downgrades.

Triggers: `clients_propagate_status_to_contacts_trg` on clients (status, manual_status) and `cca_propagate_status_to_contact_trg` on contact_company_associations (INSERT/UPDATE/DELETE).

CSV import (UpdateContactsCsvDialog) protects existing Active, Current, and Staff contacts from status overwrite; counted as `statusProtected`.

## Campaign + UI behaviour
- CampaignWizardDialog: Step 1 exposes a Status filter with all 7 options. Staff & Archived are excluded by default (must be manually checked to include). When no status is selected, query excludes status='Staff' AND status='Archived'.
- ContactList: Status filter dropdown with the 7 options + Unassigned. Company State filter removed.
- PromotionsDashboard: categoryCounts and dataHealth computed from `clientContacts = allContacts.filter(c => c.status !== 'Staff')`.
