/**
 * ADMIN LOST REASONS HOOK
 * 
 * CRUD operations for the lost_reasons lookup table.
 * Used in Admin Lookups page for managing lead lost reason options.
 */
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { toast } from 'sonner';

export interface LostReasonLookup {
  id: string;
  name: string;
  description: string | null;
  is_active: boolean;
  sort_order: number;
  created_at: string;
}

// Fetch ALL lost reasons (for admin management)
export function useAllLostReasons() {
  return useQuery({
    queryKey: ['lost-reasons', 'all'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('lost_reasons')
        .select('*')
        .order('name')
        .order('sort_order');
      
      if (error) throw error;
      return data as LostReasonLookup[];
    },
  });
}

export function useCreateLostReason() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (name: string) => {
      // Get max sort_order
      const { data: maxData } = await supabase
        .from('lost_reasons')
        .select('sort_order')
        .order('sort_order', { ascending: false })
        .limit(1)
        .single();
      
      const nextOrder = (maxData?.sort_order || 0) + 1;

      const { data, error } = await supabase
        .from('lost_reasons')
        .insert({ name, sort_order: nextOrder })
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['lost-reasons'] });
      toast.success('Lost reason created');
    },
    onError: (error: Error) => {
      toast.error('Failed to create: ' + error.message);
    },
  });
}

export function useUpdateLostReason() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, ...updates }: Partial<LostReasonLookup> & { id: string }) => {
      const { data, error } = await supabase
        .from('lost_reasons')
        .update(updates)
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['lost-reasons'] });
      toast.success('Lost reason updated');
    },
    onError: (error: Error) => {
      toast.error('Failed to update: ' + error.message);
    },
  });
}
