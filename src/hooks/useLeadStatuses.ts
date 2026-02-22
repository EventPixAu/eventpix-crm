/**
 * LEAD STATUSES HOOK
 * 
 * Provides access to lead status lookup data for admin management
 */
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

export interface LeadStatus {
  id: string;
  name: string;
  label: string;
  badge_variant: string;
  sort_order: number;
  is_active: boolean;
  is_system: boolean;
}

export function useLeadStatuses() {
  return useQuery({
    queryKey: ['lead-statuses'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('lead_statuses')
        .select('*')
        .eq('is_active', true)
        .order('sort_order', { ascending: true });
      
      if (error) throw error;
      return data as LeadStatus[];
    },
  });
}

export function useAllLeadStatuses() {
  return useQuery({
    queryKey: ['lead-statuses', 'all'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('lead_statuses')
        .select('*')
        .order('sort_order', { ascending: true });
      
      if (error) throw error;
      return data as LeadStatus[];
    },
  });
}

export function useCreateLeadStatus() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (name: string) => {
      const { data: existing } = await supabase
        .from('lead_statuses')
        .select('sort_order')
        .order('sort_order', { ascending: false })
        .limit(1);
      
      const nextOrder = (existing?.[0]?.sort_order ?? 0) + 1;
      const slug = name.toLowerCase().replace(/\s+/g, '_').replace(/[^a-z0-9_]/g, '');

      const { data, error } = await supabase
        .from('lead_statuses')
        .insert({ 
          name: slug, 
          label: name.trim(), 
          badge_variant: 'secondary',
          sort_order: nextOrder, 
          is_active: true,
          is_system: false,
        })
        .select()
        .single();
      
      if (error) throw error;
      return data as LeadStatus;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['lead-statuses'] });
      toast.success('Lead status created');
    },
    onError: (error: Error) => {
      toast.error(error.message || 'Failed to create lead status');
    },
  });
}

export function useUpdateLeadStatus() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, ...updates }: { id: string } & Partial<LeadStatus>) => {
      const updateData: Record<string, unknown> = { ...updates };
      if (updates.name && typeof updates.name === 'string') {
        updateData.label = updates.name;
        updateData.name = updates.name.toLowerCase().replace(/\s+/g, '_').replace(/[^a-z0-9_]/g, '');
      }

      const { data, error } = await supabase
        .from('lead_statuses')
        .update(updateData)
        .eq('id', id)
        .select()
        .single();
      
      if (error) throw error;
      return data as LeadStatus;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['lead-statuses'] });
      toast.success('Lead status updated');
    },
    onError: (error: Error) => {
      toast.error(error.message || 'Failed to update lead status');
    },
  });
}
