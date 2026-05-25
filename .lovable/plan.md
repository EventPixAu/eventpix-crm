## Goal
Make it easy to make Nat (or anyone) the default assignee for specific editor workflow steps, and retro-assign existing open events in one click.

## How it will work for you

**On Nat's Team profile** (Team → Nat Franks → Edit):
- New section: **Default workflow assignments**
- A grouped checkbox list of master workflow steps, with the editor-related ones surfaced first (Editor LBA/SBC, Editor Zno, Editor SMP, Editor Post, Editor Video, etc.).
- Tick the steps Nat should default to. Save.

**What ticking a step does:**
1. Any **new** event generated from now on auto-fills `assigned_to = Nat` on those steps.
2. A button appears: **"Apply to existing open events"** — one click assigns Nat to every matching open step across all active events that currently have no assignee. Skips steps already assigned to someone else (so we don't trample manual overrides).

**On the Workflows admin page** (`/admin/workflows`):
- Each master step row gets a new **Default assignee** person picker (same data, second way in).

## Technical details

### Schema
Add to `workflow_master_steps`:
- `default_assignee_user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL`

Single-assignee per step is enough — matches Studio Ninja's model and keeps the UI simple. If two people should share, leave it blank and assign per-event.

### Workflow generation
Update the step-creation path (wherever `event_workflow_steps` rows are inserted from master/template — likely `InitializeWorkflowDialog` + any RPC) to copy `default_assignee_user_id` into `assigned_to` when the row is created and no explicit assignee is provided.

### Bulk-apply RPC
New function `apply_default_step_assignees(target_user_id uuid)`:
```sql
UPDATE event_workflow_steps ews
SET assigned_to = wms.default_assignee_user_id
FROM workflow_master_steps wms, events e
WHERE ews.template_item_id IN (
        SELECT id FROM workflow_template_items WHERE master_step_id = wms.id
      )
  AND wms.default_assignee_user_id = target_user_id
  AND ews.assigned_to IS NULL
  AND ews.is_completed = false
  AND ews.event_id = e.id
  AND e.ops_status NOT IN ('cancelled','closed');
```
(Exact join path through `workflow_template_items` will be verified against the live schema before writing.)

Returns the count of rows updated. Restricted to admin/operations.

### UI
- `src/pages/admin/TeamMemberEdit.tsx` (or equivalent profile editor): new "Default workflow assignments" card with a grouped checkbox list driven by `useWorkflowMasterSteps`. Save = `UPDATE workflow_master_steps SET default_assignee_user_id = ?` for ticked rows, `= NULL` for un-ticked rows previously owned by this user.
- "Apply to existing open events" button → calls the RPC → toast "Assigned Nat to N open steps".
- `src/pages/admin/WorkflowsAdmin.tsx`: add a Default Assignee column with a person picker bound to the same column.

### Out of scope
- No new permissions changes (Nat's app role stays operations).
- No change to event_assignments / crew rostering.
- No backfill of completed or closed-event steps.

## Files touched
- `supabase/migrations/...` — column + RPC + RLS
- `src/hooks/useWorkflowMasterSteps.ts` — include `default_assignee_user_id`
- `src/pages/admin/WorkflowsAdmin.tsx` — assignee column
- `src/pages/admin/...` Team member edit page — new section + bulk-apply button
- Wherever event workflow steps are first generated — propagate default assignee

Reply **go** and I'll build it.