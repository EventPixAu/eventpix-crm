/**
 * MY JOB TASKS HOOK
 *
 * Returns workflow steps assigned directly to the current user,
 * along with whether the user has ANY assignments at all (used to
 * decide if they should land on the personal "My Tasks" dashboard
 * instead of the global Operations dashboard).
 */
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/lib/auth';
import type { JobTaskWithDueDate } from '@/hooks/useJobTasksWithDueDates';

export interface MyJobTask extends JobTaskWithDueDate {
  event_role: string | null;
}

/**
 * All incomplete workflow steps assigned to the current user.
 */
export function useMyJobTasks() {
  const { user } = useAuth();

  return useQuery({
    queryKey: ['my-job-tasks', user?.id],
    enabled: !!user?.id,
    queryFn: async (): Promise<MyJobTask[]> => {
      if (!user?.id) return [];

      const { data, error } = await supabase
        .from('event_workflow_steps')
        .select(`
          id,
          step_label,
          due_date,
          is_completed,
          event_id,
          assigned_role,
          events!inner(
            id,
            event_name,
            ops_status,
            event_date
          )
        `)
        .eq('assigned_to', user.id)
        .eq('is_completed', false)
        .not('events.ops_status', 'in', '("cancelled","closed")')
        .order('due_date', { ascending: true, nullsFirst: false });

      if (error) throw error;

      return (data || []).map((row: any) => ({
        id: row.id,
        step_label: row.step_label,
        due_date: row.due_date,
        is_completed: row.is_completed,
        event_id: row.events.id,
        event_name: row.events.event_name,
        ops_status: row.events.ops_status,
        event_date: row.events.event_date,
        event_role: row.assigned_role ?? null,
      }));
    },
  });
}

/**
 * Lightweight check: does the current user have any open workflow step assignments?
 * Used to decide which dashboard to land on.
 */
export function useHasOwnJobTasks() {
  const { user } = useAuth();

  return useQuery({
    queryKey: ['has-own-job-tasks', user?.id],
    enabled: !!user?.id,
    staleTime: 60_000,
    queryFn: async (): Promise<boolean> => {
      if (!user?.id) return false;
      const { count, error } = await supabase
        .from('event_workflow_steps')
        .select('id', { count: 'exact', head: true })
        .eq('assigned_to', user.id)
        .eq('is_completed', false);
      if (error) throw error;
      return (count ?? 0) > 0;
    },
  });
}
