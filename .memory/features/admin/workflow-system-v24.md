# Memory: features/admin/workflow-system-v24
Updated: now

## Overview
The workflow system has been restructured into three distinct categories:

### 1. Operations Master Steps
- Single flat list of all possible workflow steps in `workflow_master_steps` table
- Each step has: label, phase (pre_event/day_of/post_event), completion_type (manual/auto), date offsets
- Managed in Administration > Workflows > Operations Steps tab

### 2. Event Type Defaults
- Links event types to specific workflow steps via `event_type_step_defaults` table
- When an event is created, only the selected steps are initialized
- If no steps are selected for an event type, all active steps are used as fallback
- Managed in Administration > Workflows > Event Type Defaults tab

### 3. Sales Workflows
- Two main workflows: "New Leads" and "Repeat Clients"
- Stored in `sales_workflow_templates` with `workflow_key` column
- When creating a lead, user selects which workflow to apply
- Selected workflow stored in `leads.sales_workflow_id`
- Managed in Administration > Workflows > Sales Workflows tab

## Database Tables
- `workflow_master_steps` - Master list of operations workflow steps
- `event_type_step_defaults` - Links event types to master steps
- `sales_workflow_templates` - Sales workflow definitions (existing table, enhanced)
- `leads.sales_workflow_id` - Reference to selected sales workflow

## UI Components
- `WorkflowsAdmin.tsx` - Unified admin page with 4 tabs
- `CreateLeadDialog.tsx` - Includes workflow selection dropdown

## Key Hooks
- `useWorkflowMasterSteps.ts` - CRUD for master steps and event type defaults
- `useSalesWorkflowTemplates.ts` - CRUD for sales workflows
