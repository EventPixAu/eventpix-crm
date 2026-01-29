# Memory: features/crm/company-status-lookups
Updated: 2026-01-29

Company status values (Prospect, Current Client, Previous Client, Active Client, Inactive, Lost) are now managed via a `company_statuses` lookup table and editable in Admin Lookups. The `CompanyStatusBadgeDropdown` component dynamically fetches available statuses from the database, with hardcoded fallbacks for resilience. Status changes require admin role and a mandatory reason, logged to `company_status_audit`.
