import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { toast } from 'sonner';

export interface VenueTypeLookup {
  id: string;
  name: string;
  is_active: boolean;
  sort_order: number;
}

export function useAllVenueTypes() {
  return useQuery({
    queryKey: ['venue-types', 'all'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('venue_types' as any)
        .select('*')
        .order('sort_order')
        .order('name');
      if (error) throw error;
      return (data || []) as unknown as VenueTypeLookup[];
    },
  });
}

export function useActiveVenueTypes() {
  return useQuery({
    queryKey: ['venue-types', 'active'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('venue_types' as any)
        .select('*')
        .eq('is_active', true)
        .order('sort_order')
        .order('name');
      if (error) throw error;
      return (data || []) as unknown as VenueTypeLookup[];
    },
  });
}

export function useCreateVenueType() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (name: string) => {
      const { data: maxData } = await supabase
        .from('venue_types' as any)
        .select('sort_order')
        .order('sort_order', { ascending: false })
        .limit(1)
        .maybeSingle();
      const nextOrder = ((maxData as any)?.sort_order || 0) + 1;
      const { data, error } = await supabase
        .from('venue_types' as any)
        .insert({ name, sort_order: nextOrder } as any)
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['venue-types'] });
      toast.success('Venue type created');
    },
    onError: (error: Error) => toast.error('Failed to create: ' + error.message),
  });
}

export function useUpdateVenueType() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...updates }: Partial<VenueTypeLookup> & { id: string }) => {
      const { data, error } = await supabase
        .from('venue_types' as any)
        .update({ ...updates, updated_at: new Date().toISOString() } as any)
        .eq('id', id)
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['venue-types'] });
      toast.success('Venue type updated');
    },
    onError: (error: Error) => toast.error('Failed to update: ' + error.message),
  });
}
