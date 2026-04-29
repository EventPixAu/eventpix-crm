import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { toast } from 'sonner';

export type TaskRelatedType = 'client' | 'contact' | 'lead' | 'event' | 'delivery';
export type TaskType = 'follow_up' | 'call' | 'email' | 'prep' | 'delivery_check' | 'other';
export type TaskStatus = 'open' | 'done' | 'snoozed' | 'cancelled';
export type TaskPriority = 'low' | 'normal' | 'high' | 'urgent';

export interface Task {
  id: string;
  related_type: TaskRelatedType;
  related_id: string;
  task_type: TaskType;
  title: string;
  description: string | null;
  due_at: string | null;
  assigned_to: string | null;
  status: TaskStatus;
  priority: TaskPriority;
  snoozed_until: string | null;
  completed_at: string | null;
  completed_by: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface TaskWithAssignee extends Task {
  assignee?: {
    id: string;
    full_name: string | null;
    email: string;
  } | null;
}

export type TaskInsert = Pick<Task, 'related_type' | 'related_id' | 'title'> & 
  Partial<Pick<Task, 'task_type' | 'description' | 'due_at' | 'assigned_to' | 'priority'>>;

export type TaskUpdate = Partial<Pick<Task, 'title' | 'description' | 'due_at' | 'assigned_to' | 'status' | 'priority' | 'snoozed_until'>>;

export function useTasks(filters?: { 
  related_type?: TaskRelatedType; 
  related_id?: string;
  status?: TaskStatus;
  assigned_to?: string;
}) {
  return useQuery({
    queryKey: ['tasks', filters],
    queryFn: async () => {
      let query = supabase
        .from('tasks')
        .select(`
          *,
          assignee:profiles!tasks_assigned_to_fkey(id, full_name, email)
        `)
        .order('due_at', { ascending: true, nullsFirst: false });
      
      if (filters?.related_type) {
        query = query.eq('related_type', filters.related_type);
      }
      if (filters?.related_id) {
        query = query.eq('related_id', filters.related_id);
      }
      if (filters?.status) {
        query = query.eq('status', filters.status);
      }
      if (filters?.assigned_to) {
        query = query.eq('assigned_to', filters.assigned_to);
      }
      
      const { data, error } = await query;
      if (error) throw error;
      return data as TaskWithAssignee[];
    },
  });
}

export function useMyTasks(status?: TaskStatus) {
  return useQuery({
    queryKey: ['tasks', 'my', status],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return [];

      let query = supabase
        .from('tasks')
        .select('*')
        .eq('assigned_to', user.id)
        .order('due_at', { ascending: true, nullsFirst: false });
      
      if (status) {
        query = query.eq('status', status);
      }
      
      const { data, error } = await query;
      if (error) throw error;
      return data as Task[];
    },
  });
}

export function useTask(id: string | undefined) {
  return useQuery({
    queryKey: ['tasks', id],
    queryFn: async () => {
      if (!id) return null;
      const { data, error } = await supabase
        .from('tasks')
        .select(`
          *,
          assignee:profiles!tasks_assigned_to_fkey(id, full_name, email)
        `)
        .eq('id', id)
        .single();
      
      if (error) throw error;
      return data as TaskWithAssignee;
    },
    enabled: !!id,
  });
}

export function useCreateTask() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (task: TaskInsert) => {
      const { data: { user } } = await supabase.auth.getUser();
      
      const { data, error } = await supabase
        .from('tasks')
        .insert({
          ...task,
          created_by: user?.id,
        })
        .select()
        .single();
      
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tasks'] });
      toast.success('Task created successfully');
    },
    onError: (error) => {
      toast.error('Error creating task', { description: error.message });
    },
  });
}

export function useUpdateTask() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, ...updates }: TaskUpdate & { id: string }) => {
      const { data, error } = await supabase
        .from('tasks')
        .update(updates)
        .eq('id', id)
        .select()
        .single();
      
      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['tasks'] });
      queryClient.invalidateQueries({ queryKey: ['tasks', data.id] });
      toast.success('Task updated successfully');
    },
    onError: (error) => {
      toast.error('Error updating task', { description: error.message });
    },
  });
}

export function useCompleteTask() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      const { data: { user } } = await supabase.auth.getUser();
      
      const { data, error } = await supabase
        .from('tasks')
        .update({
          status: 'done',
          completed_at: new Date().toISOString(),
          completed_by: user?.id,
        })
        .eq('id', id)
        .select()
        .single();
      
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tasks'] });
      toast.success('Task completed');
    },
    onError: (error) => {
      toast.error('Error completing task', { description: error.message });
    },
  });
}

export function useSnoozeTask() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, until }: { id: string; until: string }) => {
      const { data, error } = await supabase
        .from('tasks')
        .update({
          status: 'snoozed',
          snoozed_until: until,
        })
        .eq('id', id)
        .select()
        .single();
      
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tasks'] });
      toast.success('Task snoozed');
    },
    onError: (error) => {
      toast.error('Error snoozing task', { description: error.message });
    },
  });
}

export function useDeleteTask() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('tasks')
        .delete()
        .eq('id', id);
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tasks'] });
      toast.success('Task deleted successfully');
    },
    onError: (error) => {
      toast.error('Error deleting task', { description: error.message });
    },
  });
}
