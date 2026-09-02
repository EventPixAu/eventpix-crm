import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { toast } from 'sonner';
import type { WorkflowPhase } from './useWorkflowMasterSteps';

export interface SeriesWorkflowStep {
  id: string;
  series_id: string;
  master_step_id: string | null;
  step_label: string;
  phase: WorkflowPhase;
  step_order: number;
  completion_type: string | null;
  auto_trigger_event: string | null;
  due_date: string | null;
  is_completed: boolean;
  completed_at: string | null;
  completed_by: string | null;
  notes: string | null;
}

export function useSeriesWorkflowSteps(seriesId: string | undefined) {
  return useQuery({
    queryKey: ['series-workflow-steps', seriesId],
    queryFn: async () => {
      if (!seriesId) return [];
      const { data, error } = await supabase
        .from('series_workflow_steps')
        .select('*')
        .eq('series_id', seriesId)
        .order('step_order');
      if (error) throw error;
      return (data || []) as unknown as SeriesWorkflowStep[];
    },
    enabled: !!seriesId,
  });
}

export function useToggleSeriesWorkflowStep() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({
      id,
      seriesId,
      isCompleted,
    }: {
      id: string;
      seriesId: string;
      isCompleted: boolean;
    }) => {
      const { data: userData } = await supabase.auth.getUser();
      const { error } = await supabase
        .from('series_workflow_steps')
        .update({
          is_completed: isCompleted,
          completed_at: isCompleted ? new Date().toISOString() : null,
          completed_by: isCompleted ? userData?.user?.id ?? null : null,
        })
        .eq('id', id);
      if (error) throw error;
      return seriesId;
    },
    onSuccess: (seriesId) => {
      qc.invalidateQueries({ queryKey: ['series-workflow-steps', seriesId] });
    },
    onError: (e: any) => toast.error('Failed to update step: ' + e.message),
  });
}

export function useSyncSeriesWorkflowSteps() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (seriesId: string) => {
      const { data, error } = await supabase.rpc('sync_series_workflow_steps' as any, {
        p_series_id: seriesId,
      });
      if (error) throw error;
      return data as any;
    },
    onSuccess: (result, seriesId) => {
      qc.invalidateQueries({ queryKey: ['series-workflow-steps', seriesId] });
      qc.invalidateQueries({ queryKey: ['event-workflow-steps'] });
      toast.success(
        `Series checklist updated — ${result?.steps_added ?? 0} step(s) added, ${result?.steps_removed ?? 0} removed`
      );
    },
    onError: (e: any) => toast.error('Failed to refresh: ' + e.message),
  });
}
