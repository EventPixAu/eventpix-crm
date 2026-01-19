import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Database } from '@/integrations/supabase/types';
import { toast } from 'sonner';

type EventWorkflowStep = Database['public']['Tables']['event_workflow_steps']['Row'];

export interface EventWorkflowStepWithProfile extends EventWorkflowStep {
  completed_by_profile?: {
    full_name: string | null;
    email: string;
  } | null;
}

// Fetch all workflow steps for an event
export function useEventWorkflowSteps(eventId: string | undefined) {
  return useQuery({
    queryKey: ['event-workflow-steps', eventId],
    queryFn: async () => {
      if (!eventId) return [];
      
      const { data, error } = await supabase
        .from('event_workflow_steps')
        .select(`
          *,
          completed_by_profile:profiles!event_workflow_steps_completed_by_fkey(full_name, email)
        `)
        .eq('event_id', eventId)
        .order('step_order');
      
      if (error) throw error;
      return data as EventWorkflowStepWithProfile[];
    },
    enabled: !!eventId,
  });
}

// Complete a workflow step (manual only)
export function useCompleteWorkflowStep() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async ({ 
      stepId, 
      eventId,
      notes 
    }: { 
      stepId: string; 
      eventId: string;
      notes?: string;
    }) => {
      const { data: { user } } = await supabase.auth.getUser();
      
      const { error } = await supabase
        .from('event_workflow_steps')
        .update({ 
          is_completed: true,
          completed_at: new Date().toISOString(),
          completed_by: user?.id || null,
          notes: notes || null,
        })
        .eq('id', stepId)
        .eq('completion_type', 'manual'); // Only allow manual completion via UI
      
      if (error) throw error;
    },
    onSuccess: (_, { eventId }) => {
      queryClient.invalidateQueries({ queryKey: ['event-workflow-steps', eventId] });
      toast.success('Step completed');
    },
    onError: (error) => {
      toast.error('Failed to complete step: ' + error.message);
    },
  });
}

// Uncomplete a workflow step (manual only)
export function useUncompleteWorkflowStep() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async ({ 
      stepId, 
      eventId 
    }: { 
      stepId: string; 
      eventId: string;
    }) => {
      const { error } = await supabase
        .from('event_workflow_steps')
        .update({ 
          is_completed: false,
          completed_at: null,
          completed_by: null,
        })
        .eq('id', stepId)
        .eq('completion_type', 'manual'); // Only allow manual uncomplete
      
      if (error) throw error;
    },
    onSuccess: (_, { eventId }) => {
      queryClient.invalidateQueries({ queryKey: ['event-workflow-steps', eventId] });
      toast.success('Step marked as incomplete');
    },
    onError: (error) => {
      toast.error('Failed to update step: ' + error.message);
    },
  });
}

// Initialize workflow steps from a template
export function useInitializeWorkflowSteps() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async ({ 
      eventId, 
      templateId 
    }: { 
      eventId: string; 
      templateId: string;
    }) => {
      const { data, error } = await supabase.rpc('initialize_event_workflow_steps', {
        p_event_id: eventId,
        p_template_id: templateId,
      });
      
      if (error) throw error;
      return data as number;
    },
    onSuccess: (count, { eventId }) => {
      queryClient.invalidateQueries({ queryKey: ['event-workflow-steps', eventId] });
      queryClient.invalidateQueries({ queryKey: ['events', eventId] });
      toast.success(`Initialized ${count} workflow steps`);
    },
    onError: (error) => {
      toast.error('Failed to initialize workflow: ' + error.message);
    },
  });
}

// Update step notes
export function useUpdateWorkflowStepNotes() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async ({ 
      stepId, 
      eventId,
      notes 
    }: { 
      stepId: string; 
      eventId: string;
      notes: string;
    }) => {
      const { error } = await supabase
        .from('event_workflow_steps')
        .update({ notes })
        .eq('id', stepId);
      
      if (error) throw error;
    },
    onSuccess: (_, { eventId }) => {
      queryClient.invalidateQueries({ queryKey: ['event-workflow-steps', eventId] });
    },
    onError: (error) => {
      toast.error('Failed to update notes: ' + error.message);
    },
  });
}

// Get workflow progress summary
export function useWorkflowProgress(eventId: string | undefined) {
  const { data: steps = [] } = useEventWorkflowSteps(eventId);
  
  const total = steps.length;
  const completed = steps.filter(s => s.is_completed).length;
  const percentage = total > 0 ? Math.round((completed / total) * 100) : 0;
  
  const overdue = steps.filter(s => 
    !s.is_completed && 
    s.due_date && 
    new Date(s.due_date) < new Date()
  ).length;
  
  const upcoming = steps.filter(s =>
    !s.is_completed &&
    s.due_date &&
    new Date(s.due_date) >= new Date() &&
    new Date(s.due_date) <= new Date(Date.now() + 7 * 24 * 60 * 60 * 1000) // Next 7 days
  ).length;
  
  return {
    total,
    completed,
    percentage,
    overdue,
    upcoming,
    steps,
  };
}
