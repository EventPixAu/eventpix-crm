/**
 * WORKFLOW TEMPLATES PAGE
 *
 * Manage workflow templates for three phases:
 * - Lead: Sales qualification and proposal
 * - Production: Pre-event and day-of execution
 * - Post-Production: Editing and delivery
 *
 * The editor itself lives in SalesWorkflowTemplatesManager so it can also
 * appear as a tab inside Workflow Configuration.
 */
import { AppLayout } from '@/components/layout/AppLayout';
import { PageHeader } from '@/components/layout/PageHeader';
import { SalesWorkflowTemplatesManager } from '@/components/admin/SalesWorkflowTemplatesManager';

export default function SalesWorkflowTemplates() {
  return (
    <AppLayout>
      <PageHeader
        title="Workflow Templates"
        description="Manage workflow templates by phase"
      />
      <SalesWorkflowTemplatesManager />
    </AppLayout>
  );
}
