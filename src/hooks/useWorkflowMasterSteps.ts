import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

export type WorkflowPhase = 'pre_event' | 'day_of' | 'post_event';

export interface WorkflowMasterStep {
  id: string;
  label: string;
  phase: WorkflowPhase;
  sort_order: number;
  completion_type: 'manual' | 'auto';
  auto_trigger_event: string | null;
  date_offset_days: number | null;
  date_offset_reference: 'lead_created' | 'job_accepted' | 'event_date' | 'delivery_deadline' | null;
  help_text: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface EventTypeStepDefault {
  id: string;
  event_type_id: string;
  master_step_id: string;
  created_at: string;
}

export const PHASE_CONFIG = {
  pre_event: { label: 'Pre-Event', color: 'text-info' },
  day_of: { label: 'Day Of', color: 'text-warning' },
  post_event: { label: 'Post-Event', color: 'text-success' },
} as const;

// Fetch all master steps
export function useWorkflowMasterSteps() {
  return useQuery({
    queryKey: ['workflow-master-steps'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('workflow_master_steps')
        .select('*')
        .order('phase')
        .order('date_offset_days', { ascending: true, nullsFirst: true })
        .order('sort_order');
      
      if (error) throw error;
      return data as WorkflowMasterStep[];
    },
  });
}

// Fetch active master steps only
export function useActiveWorkflowMasterSteps() {
  return useQuery({
    queryKey: ['workflow-master-steps', 'active'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('workflow_master_steps')
        .select('*')
        .eq('is_active', true)
        .order('phase')
        .order('date_offset_days', { ascending: true, nullsFirst: true })
        .order('sort_order');
      
      if (error) throw error;
      return data as WorkflowMasterStep[];
    },
  });
}

// Create a new master step
export function useCreateMasterStep() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async (step: Omit<WorkflowMasterStep, 'id' | 'created_at' | 'updated_at'>) => {
      const { data, error } = await supabase
        .from('workflow_master_steps')
        .insert(step)
        .select()
        .single();
      
      if (error) throw error;
      
      // Auto-reorder steps by date_offset_days within the phase
      await reorderStepsByDateOffset(step.phase);
      
      return data as WorkflowMasterStep;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['workflow-master-steps'] });
      toast.success('Workflow step created');
    },
    onError: (error) => {
      toast.error('Failed to create step: ' + error.message);
    },
  });
}

// Helper to reorder steps by date_offset_days within a phase
async function reorderStepsByDateOffset(phase: WorkflowPhase) {
  // Fetch all steps in this phase
  const { data: phaseSteps, error: fetchError } = await supabase
    .from('workflow_master_steps')
    .select('id, date_offset_days')
    .eq('phase', phase)
    .order('date_offset_days', { ascending: true, nullsFirst: true });
  
  if (fetchError || !phaseSteps) return;
  
  // Update sort_order based on date_offset_days order
  const updates = phaseSteps.map((step, index) =>
    supabase
      .from('workflow_master_steps')
      .update({ sort_order: index, updated_at: new Date().toISOString() })
      .eq('id', step.id)
  );
  
  await Promise.all(updates);
}

// Update a master step
export function useUpdateMasterStep() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async ({ id, ...updates }: Partial<WorkflowMasterStep> & { id: string }) => {
      const { data, error } = await supabase
        .from('workflow_master_steps')
        .update({ ...updates, updated_at: new Date().toISOString() })
        .eq('id', id)
        .select()
        .single();
      
      if (error) throw error;
      
      // Auto-reorder steps by date_offset_days within the phase
      await reorderStepsByDateOffset(data.phase as WorkflowPhase);
      
      return data as WorkflowMasterStep;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['workflow-master-steps'] });
      toast.success('Workflow step updated');
    },
    onError: (error) => {
      toast.error('Failed to update step: ' + error.message);
    },
  });
}

// Reorder master steps within a phase
export function useReorderMasterSteps() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async (steps: { id: string; sort_order: number }[]) => {
      // Update each step's sort_order
      const updates = steps.map(({ id, sort_order }) =>
        supabase
          .from('workflow_master_steps')
          .update({ sort_order, updated_at: new Date().toISOString() })
          .eq('id', id)
      );
      
      const results = await Promise.all(updates);
      const error = results.find(r => r.error)?.error;
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['workflow-master-steps'] });
    },
    onError: (error) => {
      toast.error('Failed to reorder steps: ' + error.message);
    },
  });
}

// Delete a master step
export function useDeleteMasterStep() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('workflow_master_steps')
        .delete()
        .eq('id', id);
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['workflow-master-steps'] });
      toast.success('Workflow step deleted');
    },
    onError: (error) => {
      toast.error('Failed to delete step: ' + error.message);
    },
  });
}

// Fetch step defaults for all event types
export function useAllEventTypeStepDefaults() {
  return useQuery({
    queryKey: ['event-type-step-defaults'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('event_type_step_defaults')
        .select('*');
      
      if (error) throw error;
      return data as EventTypeStepDefault[];
    },
  });
}

// Set step defaults for an event type
export function useSetEventTypeStepDefaults() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async ({ 
      eventTypeId, 
      stepIds 
    }: { 
      eventTypeId: string; 
      stepIds: string[];
    }) => {
      // Delete existing defaults for this event type
      const { error: deleteError } = await supabase
        .from('event_type_step_defaults')
        .delete()
        .eq('event_type_id', eventTypeId);
      
      if (deleteError) throw deleteError;
      
      // Insert new defaults
      if (stepIds.length > 0) {
        const defaults = stepIds.map(stepId => ({
          event_type_id: eventTypeId,
          master_step_id: stepId,
        }));
        
        const { error: insertError } = await supabase
          .from('event_type_step_defaults')
          .insert(defaults);
        
        if (insertError) throw insertError;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['event-type-step-defaults'] });
      toast.success('Event type workflow updated');
    },
    onError: (error) => {
      toast.error('Failed to update defaults: ' + error.message);
    },
  });
}
