/**
 * COMPANY STATUSES HOOK
 * 
 * Provides access to company status lookup data for admin management
 */
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { toast } from 'sonner';

export interface CompanyStatus {
  id: string;
  name: string;
  label: string;
  badge_variant: string;
  sort_order: number;
  is_active: boolean;
  is_system: boolean;
}

export function useCompanyStatuses() {
  return useQuery({
    queryKey: ['company-statuses'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('company_statuses')
        .select('*')
        .eq('is_active', true)
        .order('sort_order', { ascending: true });
      
      if (error) throw error;
      return data as CompanyStatus[];
    },
  });
}

export function useAllCompanyStatuses() {
  return useQuery({
    queryKey: ['company-statuses', 'all'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('company_statuses')
        .select('*')
        .order('sort_order', { ascending: true });
      
      if (error) throw error;
      return data as CompanyStatus[];
    },
  });
}

export function useCreateCompanyStatus() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (name: string) => {
      // Get max sort_order
      const { data: existing } = await supabase
        .from('company_statuses')
        .select('sort_order')
        .order('sort_order', { ascending: false })
        .limit(1);
      
      const nextOrder = (existing?.[0]?.sort_order ?? 0) + 1;
      
      // Generate a slug from the name
      const slug = name.toLowerCase().replace(/\s+/g, '_').replace(/[^a-z0-9_]/g, '');

      const { data, error } = await supabase
        .from('company_statuses')
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
      return data as CompanyStatus;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['company-statuses'] });
      toast.success('Status created');
    },
    onError: (error: Error) => {
      toast.error(error.message || 'Failed to create status');
    },
  });
}

export function useUpdateCompanyStatus() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, ...updates }: { id: string } & Partial<CompanyStatus>) => {
      // If updating name (label), also update the slug
      const updateData: Record<string, unknown> = { ...updates };
      if (updates.name && typeof updates.name === 'string') {
        // When updating via the lookup table, name = label display name
        // So we need to set label = name and slug the name field
        updateData.label = updates.name;
        updateData.name = updates.name.toLowerCase().replace(/\s+/g, '_').replace(/[^a-z0-9_]/g, '');
      }

      const { data, error } = await supabase
        .from('company_statuses')
        .update(updateData)
        .eq('id', id)
        .select()
        .single();
      
      if (error) throw error;
      return data as CompanyStatus;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['company-statuses'] });
      toast.success('Status updated');
    },
    onError: (error: Error) => {
      toast.error(error.message || 'Failed to update status');
    },
  });
}
