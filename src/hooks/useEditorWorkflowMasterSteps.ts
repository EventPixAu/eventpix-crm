import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { toast } from 'sonner';
import type { WorkflowMasterStep, EventTypeStepDefault, WorkflowPhase } from './useWorkflowMasterSteps';

const MASTER_KEY = ['editor-workflow-master-steps'];
const DEFAULTS_KEY = ['editor-event-type-step-defaults'];

export function useEditorWorkflowMasterSteps() {
  return useQuery({
    queryKey: MASTER_KEY,
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from('editor_workflow_master_steps')
        .select('*')
        .order('phase')
        .order('sort_order');
      if (error) throw error;
      return (data || []) as WorkflowMasterStep[];
    },
  });
}

export function useCreateEditorMasterStep() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (step: Omit<WorkflowMasterStep, 'id' | 'created_at' | 'updated_at'>) => {
      const { data, error } = await (supabase as any)
        .from('editor_workflow_master_steps')
        .insert(step)
        .select()
        .single();
      if (error) throw error;
      return data as WorkflowMasterStep;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: MASTER_KEY });
      toast.success('Editor step created');
    },
    onError: (e: any) => toast.error('Failed to create step: ' + e.message),
  });
}

export function useUpdateEditorMasterStep() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...updates }: Partial<WorkflowMasterStep> & { id: string }) => {
      const { data, error } = await (supabase as any)
        .from('editor_workflow_master_steps')
        .update({ ...updates, updated_at: new Date().toISOString() })
        .eq('id', id)
        .select()
        .single();
      if (error) throw error;
      return data as WorkflowMasterStep;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: MASTER_KEY });
      toast.success('Editor step updated');
    },
    onError: (e: any) => toast.error('Failed to update step: ' + e.message),
  });
}

export function useDeleteEditorMasterStep() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await (supabase as any)
        .from('editor_workflow_master_steps')
        .delete()
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: MASTER_KEY });
      qc.invalidateQueries({ queryKey: DEFAULTS_KEY });
      toast.success('Editor step deleted');
    },
    onError: (e: any) => toast.error('Failed to delete step: ' + e.message),
  });
}

export function useAllEditorEventTypeStepDefaults() {
  return useQuery({
    queryKey: DEFAULTS_KEY,
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from('editor_event_type_step_defaults')
        .select('*');
      if (error) throw error;
      return (data || []) as EventTypeStepDefault[];
    },
  });
}

export function useSetEditorEventTypeStepDefaults() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ eventTypeId, stepIds }: { eventTypeId: string; stepIds: string[] }) => {
      const { error: delErr } = await (supabase as any)
        .from('editor_event_type_step_defaults')
        .delete()
        .eq('event_type_id', eventTypeId);
      if (delErr) throw delErr;
      if (stepIds.length > 0) {
        const rows = stepIds.map((stepId) => ({ event_type_id: eventTypeId, master_step_id: stepId }));
        const { error: insErr } = await (supabase as any)
          .from('editor_event_type_step_defaults')
          .insert(rows);
        if (insErr) throw insErr;
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: DEFAULTS_KEY });
      toast.success('Editor workflow updated');
    },
    onError: (e: any) => toast.error('Failed to update: ' + e.message),
  });
}

export type { WorkflowMasterStep, EventTypeStepDefault, WorkflowPhase };
