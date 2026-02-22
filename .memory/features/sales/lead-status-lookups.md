# Memory: features/sales/lead-status-lookups
Updated: 2026-02-22

Lead status values (New Lead, Budget Sent, Agreement Sent, Won, Lost) are managed via the `lead_statuses` lookup table and editable in Admin Lookups. The Lead Summary Card on the lead detail page includes an inline status dropdown for changing status. The lead list page pipeline summary cards and status badges are dynamically driven from this lookup table. Selecting 'Lost' from the dropdown triggers the lost-reason dialog flow.
