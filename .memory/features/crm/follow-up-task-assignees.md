---
name: Follow-up Task Assignees
description: CRM follow-up tasks can only be assigned to salaried staff (profiles.is_salaried = true)
type: feature
---

CRM follow-up tasks (tasks with related_type='contact' etc.) must only be assignable to salaried team members.

- Assignee dropdowns for creating/editing follow-up tasks must filter `profiles` by `is_active = true AND is_salaried = true`.
- Hourly/contract crew are excluded — follow-ups are an internal salaried-staff responsibility.
- Applied in `src/components/ContactFollowUpTasksPanel.tsx` (`task-assignee-options` query). Apply the same filter to any future task-creation UI.
