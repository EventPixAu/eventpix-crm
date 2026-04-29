/**
 * HOOK: Job Tasks with Due Dates
 * 
 * Fetches incomplete workflow steps across all events, ordered by due date.
 * Used for the Operations Dashboard task queue.
 */
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';

export interface JobTaskWithDueDate {
  id: string;
  step_label: string;
  due_date: string | null;
  is_completed: boolean;
  event_id: string;
  event_name: string;
  ops_status: string | null;
  event_date: string;
}

export function useJobTasksWithDueDates(options?: { 
  limit?: number; 
  includeCompleted?: boolean;
  showOverdueOnly?: boolean;
}) {
  const { limit = 50, includeCompleted = false, showOverdueOnly = false } = options || {};
  
  return useQuery({
    queryKey: ['job-tasks-with-due-dates', { limit, includeCompleted, showOverdueOnly }],
    queryFn: async () => {
      let query = supabase
        .from('event_workflow_steps')
        .select(`
          id,
          step_label,
          due_date,
          is_completed,
          event_id,
          events!inner(
            id,
            event_name,
            ops_status,
            event_date
          )
        `)
        .not('due_date', 'is', null)
        .order('due_date', { ascending: true });
      
      if (!includeCompleted) {
        query = query.eq('is_completed', false);
      }
      
      // Filter to exclude cancelled/closed events
      query = query.not('events.ops_status', 'in', '("cancelled","closed")');
      
      if (limit) {
        query = query.limit(limit);
      }
      
      const { data, error } = await query;
      
      if (error) throw error;
      
      // Transform and optionally filter by overdue
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      
      const tasks = (data || []).map((row: any) => ({
        id: row.id,
        step_label: row.step_label,
        due_date: row.due_date,
        is_completed: row.is_completed,
        event_id: row.events.id,
        event_name: row.events.event_name,
        ops_status: row.events.ops_status,
        event_date: row.events.event_date,
      }));
      
      if (showOverdueOnly) {
        return tasks.filter(task => {
          if (!task.due_date) return false;
          const dueDate = new Date(task.due_date);
          return dueDate < today;
        });
      }
      
      return tasks as JobTaskWithDueDate[];
    },
  });
}

export function useNextTaskPerEvent() {
  return useQuery({
    queryKey: ['next-task-per-event'],
    queryFn: async () => {
      // Get all incomplete tasks with due dates
      const { data, error } = await supabase
        .from('event_workflow_steps')
        .select(`
          id,
          step_label,
          due_date,
          is_completed,
          step_order,
          event_id,
          events!inner(
            id,
            event_name,
            ops_status,
            event_date
          )
        `)
        .eq('is_completed', false)
        .not('events.ops_status', 'in', '("cancelled","closed")')
        .order('step_order', { ascending: true });
      
      if (error) throw error;
      
      // Group by event and get the first incomplete task (by step_order)
      const tasksByEvent = new Map<string, any>();
      
      for (const row of data || []) {
        const eventId = row.events.id;
        if (!tasksByEvent.has(eventId)) {
          tasksByEvent.set(eventId, {
            id: row.id,
            step_label: row.step_label,
            due_date: row.due_date,
            is_completed: row.is_completed,
            event_id: eventId,
            event_name: row.events.event_name,
            ops_status: row.events.ops_status,
            event_date: row.events.event_date,
          });
        }
      }
      
      // Convert to array and sort by due_date
      const tasks = Array.from(tasksByEvent.values());
      tasks.sort((a, b) => {
        if (!a.due_date && !b.due_date) return 0;
        if (!a.due_date) return 1;
        if (!b.due_date) return -1;
        return new Date(a.due_date).getTime() - new Date(b.due_date).getTime();
      });
      
      return tasks as JobTaskWithDueDate[];
    },
  });
}
