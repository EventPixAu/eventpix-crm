# Memory: features/workflow/crew-checklist-phases
Updated: now

## Overview
Crew workflow tasks are consolidated into the main Event Workflow system rather than being managed as separate crew checklists. Each workflow step in `event_workflow_steps` can be assigned to a specific team member via the `assigned_to` column (UUID FK to auth.users).

## Assignment Model
- Default assignment is "Management" (assigned_to = NULL)
- Steps can be assigned to any staff member assigned to the event
- The Edit Workflow Step dialog shows a dropdown with event staff (fetched from event_assignments)
- Staff names are shown with their role in parentheses (e.g., "John Smith (Lead Photographer)")

## Database
- `event_workflow_steps.assigned_to` - UUID FK to auth.users, nullable, default Management
- Profile data for assignees is fetched separately in the useEventWorkflowSteps hook

## UI
- `EditWorkflowStepDialog.tsx` - Includes "Assigned To" dropdown with Management + event staff
- `JobWorkflowRail.tsx` - Shows assignee name badge on each step
