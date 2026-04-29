/**
 * CLIENT WORKFLOW PROGRESS HOOK
 * 
 * Fetches and aggregates workflow progress for a client
 * across all their leads (Sales) and events (Operations).
 */
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';

export interface WorkflowProgressItem {
  entityId: string;
  entityType: 'lead' | 'job';
  entityName: string;
  entityDate: string | null;
  entityStatus: string | null;
  templateName: string;
  workflowDomain: 'sales' | 'operations';
  totalSteps: number;
  completedSteps: number;
  overdueSteps: number;
  percentage: number;
  hasWorkflow: boolean;
}

export interface ClientWorkflowSummary {
  salesWorkflows: WorkflowProgressItem[];
  operationsWorkflows: WorkflowProgressItem[];
  salesProgress: { total: number; completed: number; percentage: number };
  operationsProgress: { total: number; completed: number; percentage: number };
  overallProgress: { total: number; completed: number; percentage: number };
}

export function useClientWorkflowProgress(clientId: string | undefined) {
  return useQuery({
    queryKey: ['client-workflow-progress', clientId],
    queryFn: async (): Promise<ClientWorkflowSummary> => {
      if (!clientId) {
        return {
          salesWorkflows: [],
          operationsWorkflows: [],
          salesProgress: { total: 0, completed: 0, percentage: 0 },
          operationsProgress: { total: 0, completed: 0, percentage: 0 },
          overallProgress: { total: 0, completed: 0, percentage: 0 },
        };
      }

      const now = new Date();

      // Fetch all leads for this client with their workflow instances
      const { data: leads, error: leadsError } = await supabase
        .from('leads')
        .select(`
          id,
          lead_name,
          estimated_event_date,
          status
        `)
        .eq('client_id', clientId)
        .not('status', 'eq', 'lost');

      if (leadsError) throw leadsError;

      // Fetch all events for this client
      const { data: events, error: eventsError } = await supabase
        .from('events')
        .select(`
          id,
          event_name,
          event_date,
          ops_status
        `)
        .eq('client_id', clientId)
        .not('ops_status', 'eq', 'cancelled');

      if (eventsError) throw eventsError;

      // Fetch workflow instances for leads and jobs
      const leadIds = leads?.map(l => l.id) || [];
      const eventIds = events?.map(e => e.id) || [];

      let workflowInstances: any[] = [];

      if (leadIds.length > 0 || eventIds.length > 0) {
        const { data: instances, error: instancesError } = await supabase
          .from('workflow_instances')
          .select(`
            id,
            entity_type,
            entity_id,
            template:workflow_templates!workflow_instances_template_id_fkey(
              id,
              template_name,
              workflow_domain
            ),
            steps:workflow_instance_steps(
              id,
              is_complete,
              due_at
            )
          `)
          .or(`entity_id.in.(${[...leadIds, ...eventIds].join(',')})`);

        if (instancesError) throw instancesError;
        workflowInstances = instances || [];
      }

      // Build progress items
      const salesWorkflows: WorkflowProgressItem[] = [];
      const operationsWorkflows: WorkflowProgressItem[] = [];

      // Process leads
      for (const lead of leads || []) {
        const instance = workflowInstances.find(
          wi => wi.entity_type === 'lead' && wi.entity_id === lead.id
        );

        const item: WorkflowProgressItem = {
          entityId: lead.id,
          entityType: 'lead',
          entityName: lead.lead_name,
          entityDate: lead.estimated_event_date,
          entityStatus: lead.status,
          templateName: instance?.template?.template_name || 'No workflow',
          workflowDomain: (instance?.template?.workflow_domain as 'sales' | 'operations') || 'sales',
          totalSteps: instance?.steps?.length || 0,
          completedSteps: instance?.steps?.filter((s: any) => s.is_complete).length || 0,
          overdueSteps: instance?.steps?.filter((s: any) => 
            !s.is_complete && s.due_at && new Date(s.due_at) < now
          ).length || 0,
          percentage: 0,
          hasWorkflow: !!instance,
        };

        item.percentage = item.totalSteps > 0 
          ? Math.round((item.completedSteps / item.totalSteps) * 100) 
          : 0;

        // Lead workflows go to sales or operations based on template domain
        if (item.workflowDomain === 'sales' || !instance) {
          salesWorkflows.push(item);
        } else {
          operationsWorkflows.push(item);
        }
      }

      // Process events/jobs
      for (const event of events || []) {
        const instance = workflowInstances.find(
          wi => wi.entity_type === 'job' && wi.entity_id === event.id
        );

        const item: WorkflowProgressItem = {
          entityId: event.id,
          entityType: 'job',
          entityName: event.event_name,
          entityDate: event.event_date,
          entityStatus: event.ops_status,
          templateName: instance?.template?.template_name || 'No workflow',
          workflowDomain: (instance?.template?.workflow_domain as 'sales' | 'operations') || 'operations',
          totalSteps: instance?.steps?.length || 0,
          completedSteps: instance?.steps?.filter((s: any) => s.is_complete).length || 0,
          overdueSteps: instance?.steps?.filter((s: any) => 
            !s.is_complete && s.due_at && new Date(s.due_at) < now
          ).length || 0,
          percentage: 0,
          hasWorkflow: !!instance,
        };

        item.percentage = item.totalSteps > 0 
          ? Math.round((item.completedSteps / item.totalSteps) * 100) 
          : 0;

        // Job workflows go to operations by default
        operationsWorkflows.push(item);
      }

      // Calculate aggregate progress
      const salesTotal = salesWorkflows.reduce((sum, w) => sum + w.totalSteps, 0);
      const salesCompleted = salesWorkflows.reduce((sum, w) => sum + w.completedSteps, 0);
      
      const opsTotal = operationsWorkflows.reduce((sum, w) => sum + w.totalSteps, 0);
      const opsCompleted = operationsWorkflows.reduce((sum, w) => sum + w.completedSteps, 0);

      return {
        salesWorkflows,
        operationsWorkflows,
        salesProgress: {
          total: salesTotal,
          completed: salesCompleted,
          percentage: salesTotal > 0 ? Math.round((salesCompleted / salesTotal) * 100) : 0,
        },
        operationsProgress: {
          total: opsTotal,
          completed: opsCompleted,
          percentage: opsTotal > 0 ? Math.round((opsCompleted / opsTotal) * 100) : 0,
        },
        overallProgress: {
          total: salesTotal + opsTotal,
          completed: salesCompleted + opsCompleted,
          percentage: (salesTotal + opsTotal) > 0 
            ? Math.round(((salesCompleted + opsCompleted) / (salesTotal + opsTotal)) * 100) 
            : 0,
        },
      };
    },
    enabled: !!clientId,
  });
}
