/**
 * WORKFLOW INSTANCES HOOKS
 * 
 * Manages workflow instances for Leads and Jobs.
 * Handles step completion, due date display, and auto-triggers.
 */
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Database } from '@/integrations/supabase/types';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/lib/auth';

type WorkflowInstance = Database['public']['Tables']['workflow_instances']['Row'];
type WorkflowInstanceStep = Database['public']['Tables']['workflow_instance_steps']['Row'];
type WorkflowTemplateItem = Database['public']['Tables']['workflow_template_items']['Row'];

export interface WorkflowInstanceStepWithDetails extends WorkflowInstanceStep {
  step: WorkflowTemplateItem;
  completed_by_profile?: {
    full_name: string | null;
  } | null;
}

export interface WorkflowInstanceWithSteps extends WorkflowInstance {
  template: {
    id: string;
    template_name: string;
    applies_to: string | null;
  };
  steps: WorkflowInstanceStepWithDetails[];
}

// Get workflow instance for a Lead
export function useLeadWorkflowInstance(leadId: string | undefined) {
  return useQuery({
    queryKey: ['workflow-instance', 'lead', leadId],
    queryFn: async () => {
      if (!leadId) return null;
      
      const { data, error } = await supabase
        .from('workflow_instances')
        .select(`
          *,
          template:workflow_templates!workflow_instances_template_id_fkey(id, template_name, applies_to),
          steps:workflow_instance_steps(
            *,
            step:workflow_template_items!workflow_instance_steps_step_id_fkey(*),
            completed_by_profile:profiles!workflow_instance_steps_completed_by_fkey(full_name)
          )
        `)
        .eq('entity_type', 'lead')
        .eq('entity_id', leadId)
        .single();
      
      if (error) {
        if (error.code === 'PGRST116') return null; // Not found
        throw error;
      }
      
      // Sort steps by step.sort_order
      if (data?.steps) {
        data.steps.sort((a: any, b: any) => 
          (a.step?.sort_order || 0) - (b.step?.sort_order || 0)
        );
      }
      
      return data as WorkflowInstanceWithSteps;
    },
    enabled: !!leadId,
  });
}

// Get workflow instance for a Job (Event)
export function useJobWorkflowInstance(jobId: string | undefined) {
  return useQuery({
    queryKey: ['workflow-instance', 'job', jobId],
    queryFn: async () => {
      if (!jobId) return null;
      
      const { data, error } = await supabase
        .from('workflow_instances')
        .select(`
          *,
          template:workflow_templates!workflow_instances_template_id_fkey(id, template_name, applies_to),
          steps:workflow_instance_steps(
            *,
            step:workflow_template_items!workflow_instance_steps_step_id_fkey(*),
            completed_by_profile:profiles!workflow_instance_steps_completed_by_fkey(full_name)
          )
        `)
        .eq('entity_type', 'job')
        .eq('entity_id', jobId)
        .single();
      
      if (error) {
        if (error.code === 'PGRST116') return null;
        throw error;
      }
      
      if (data?.steps) {
        data.steps.sort((a: any, b: any) => 
          (a.step?.sort_order || 0) - (b.step?.sort_order || 0)
        );
      }
      
      return data as WorkflowInstanceWithSteps;
    },
    enabled: !!jobId,
  });
}

// Initialize a workflow instance from a template
export function useInitializeWorkflow() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  
  return useMutation({
    mutationFn: async ({
      templateId,
      entityType,
      entityId,
      mainShootAt,
    }: {
      templateId: string;
      entityType: 'lead' | 'job';
      entityId: string;
      mainShootAt?: string | null;
    }) => {
      const { data, error } = await supabase.rpc('create_workflow_instance', {
        p_template_id: templateId,
        p_entity_type: entityType,
        p_entity_id: entityId,
        p_main_shoot_at: mainShootAt || null,
      });
      
      if (error) throw error;
      return data;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['workflow-instance', variables.entityType, variables.entityId] });
      toast({ title: 'Workflow initialized successfully' });
    },
    onError: (error: Error) => {
      toast({ 
        title: 'Failed to initialize workflow', 
        description: error.message, 
        variant: 'destructive' 
      });
    },
  });
}

// Toggle a workflow step completion (manual steps only)
export function useToggleWorkflowStep() {
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const { toast } = useToast();
  
  return useMutation({
    mutationFn: async ({
      stepId,
      instanceId,
      entityType,
      entityId,
      isComplete,
    }: {
      stepId: string;
      instanceId: string;
      entityType: 'lead' | 'job';
      entityId: string;
      isComplete: boolean;
    }) => {
      const { data, error } = await supabase
        .from('workflow_instance_steps')
        .update({
          is_complete: isComplete,
          completed_at: isComplete ? new Date().toISOString() : null,
          completed_by: isComplete ? user?.id : null,
        })
        .eq('id', stepId)
        .eq('is_locked', false) // Cannot update locked steps
        .select()
        .single();
      
      if (error) throw error;
      return data;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ 
        queryKey: ['workflow-instance', variables.entityType, variables.entityId] 
      });
    },
    onError: (error: Error) => {
      toast({ 
        title: 'Failed to update step', 
        description: error.message, 
        variant: 'destructive' 
      });
    },
  });
}

// Recalculate due dates for a workflow instance
export function useRecalculateDueDates() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  
  return useMutation({
    mutationFn: async ({
      instanceId,
      entityType,
      entityId,
      mainShootAt,
    }: {
      instanceId: string;
      entityType: 'lead' | 'job';
      entityId: string;
      mainShootAt: string;
    }) => {
      // Get all steps for this instance
      const { data: steps, error: fetchError } = await supabase
        .from('workflow_instance_steps')
        .select(`
          id,
          step:workflow_template_items!workflow_instance_steps_step_id_fkey(
            step_type,
            schedule_anchor_type,
            schedule_anchor_step_id,
            date_offset_days
          )
        `)
        .eq('instance_id', instanceId);
      
      if (fetchError) throw fetchError;
      
      // Update due dates for scheduled steps
      for (const instanceStep of steps || []) {
        const step = instanceStep.step as any;
        if (step?.step_type === 'scheduled' && step?.schedule_anchor_type === 'main_shoot' && step?.date_offset_days != null) {
          const mainDate = new Date(mainShootAt);
          const dueDate = new Date(mainDate);
          dueDate.setDate(dueDate.getDate() + step.date_offset_days);
          
          await supabase
            .from('workflow_instance_steps')
            .update({ due_at: dueDate.toISOString() })
            .eq('id', instanceStep.id);
        }
      }
      
      return true;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ 
        queryKey: ['workflow-instance', variables.entityType, variables.entityId] 
      });
      toast({ title: 'Due dates recalculated' });
    },
    onError: (error: Error) => {
      toast({ 
        title: 'Failed to recalculate due dates', 
        description: error.message, 
        variant: 'destructive' 
      });
    },
  });
}

// Get available workflow templates for leads or jobs
export function useWorkflowTemplatesForEntity(entityType: 'lead' | 'job' | 'both') {
  return useQuery({
    queryKey: ['workflow-templates', 'for-entity', entityType],
    queryFn: async () => {
      let query = supabase
        .from('workflow_templates')
        .select('id, template_name, applies_to, description')
        .eq('is_active', true);
      
      if (entityType !== 'both') {
        query = query.or(`applies_to.eq.${entityType},applies_to.eq.both`);
      }
      
      const { data, error } = await query.order('template_name');
      
      if (error) throw error;
      return data;
    },
  });
}
