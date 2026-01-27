# Memory: features/crew/role-based-checklists-v2
Updated: now

## Overview
Role-based crew checklist templates are managed in the Workflows section. Each template can be linked to a specific `staff_role_id` (e.g., Lead Photographer, Assistant, Videographer).

## Workflow
1. **Admin creates templates** in Workflows > Crew Checklists tab, optionally assigning a role
2. **Staff is assigned to event** via StaffAssignmentDialog with a role
3. **Checklist is auto-created** matching the staff's role template (or default if no match)
4. **Admin can view/edit** the checklist in Event Detail > Assignments tab
5. **Crew member sees** their personalized checklist in the Team app

## Key Components
- `CrewChecklistTemplatesManager.tsx` - Admin CRUD for templates
- `AssignmentChecklistPanel.tsx` - Per-assignment checklist editor in Event Detail
- `useCrewChecklists.ts` - Hooks including `useCreateCrewChecklistForUser()` for admin use

## Database
- `crew_checklist_templates` - Template definitions with `staff_role_id` FK
- `crew_checklists` - Per-user, per-event checklist instances
- `crew_checklist_items` - Individual checklist items with completion status

## RLS Policies
- Crew can view/update their own checklists
- Admins and Ops can manage all checklists and items
