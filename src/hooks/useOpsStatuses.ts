import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

export interface OpsStatus {
  id: string;
  name: string;
  label: string;
  sort_order: number;
  is_active: boolean;
  is_system: boolean;
}

export function useOpsStatuses() {
  return useQuery({
    queryKey: ['ops-statuses'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('ops_statuses' as any)
        .select('*')
        .eq('is_active', true)
        .order('label', { ascending: true })
        .order('sort_order', { ascending: true });
      if (error) throw error;
      return data as unknown as OpsStatus[];
    },
  });
}

export function useAllOpsStatuses() {
  return useQuery({
    queryKey: ['ops-statuses', 'all'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('ops_statuses' as any)
        .select('*')
        .order('label', { ascending: true })
        .order('sort_order', { ascending: true });
      if (error) throw error;
      return data as unknown as OpsStatus[];
    },
  });
}

export function useCreateOpsStatus() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (name: string) => {
      const { data: existing } = await supabase
        .from('ops_statuses' as any)
        .select('sort_order')
        .order('sort_order', { ascending: false })
        .limit(1);
      const nextOrder = ((existing as any)?.[0]?.sort_order ?? 0) + 1;
      const slug = name.toLowerCase().replace(/\s+/g, '_').replace(/[^a-z0-9_]/g, '');
      const { data, error } = await supabase
        .from('ops_statuses' as any)
        .insert({ name: slug, label: name.trim(), sort_order: nextOrder, is_active: true, is_system: false })
        .select()
        .single();
      if (error) throw error;
      return data as unknown as OpsStatus;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['ops-statuses'] });
      toast.success('Operations status created');
    },
    onError: (error: Error) => toast.error(error.message || 'Failed to create status'),
  });
}

export function useUpdateOpsStatus() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...updates }: { id: string } & Partial<OpsStatus>) => {
      const updateData: Record<string, unknown> = { ...updates };
      if (updates.name && typeof updates.name === 'string') {
        updateData.label = updates.name;
        updateData.name = updates.name.toLowerCase().replace(/\s+/g, '_').replace(/[^a-z0-9_]/g, '');
      }
      const { data, error } = await supabase
        .from('ops_statuses' as any)
        .update(updateData)
        .eq('id', id)
        .select()
        .single();
      if (error) throw error;
      return data as unknown as OpsStatus;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['ops-statuses'] });
      toast.success('Operations status updated');
    },
    onError: (error: Error) => toast.error(error.message || 'Failed to update status'),
  });
}
