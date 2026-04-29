/**
 * COMPANY CATEGORIES HOOK
 * 
 * Provides access to company category lookup data
 */
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { toast } from 'sonner';

interface CompanyCategory {
  id: string;
  name: string;
  sort_order: number;
  is_active: boolean;
}

// Returns ACTIVE company categories (for dropdowns)
export function useCompanyCategories() {
  return useQuery({
    queryKey: ['company-categories'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('company_categories')
        .select('*')
        .eq('is_active', true)
        .order('name', { ascending: true });
      
      if (error) throw error;
      return data as CompanyCategory[];
    },
  });
}

// Returns ALL company categories (for admin)
export function useAllCompanyCategories() {
  return useQuery({
    queryKey: ['company-categories', 'all'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('company_categories')
        .select('*')
        .order('sort_order')
        .order('name');
      
      if (error) throw error;
      return data as CompanyCategory[];
    },
  });
}

export function useCreateCompanyCategory() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (name: string) => {
      // Get max sort_order
      const { data: existing } = await supabase
        .from('company_categories')
        .select('sort_order')
        .order('sort_order', { ascending: false })
        .limit(1);
      
      const nextOrder = (existing?.[0]?.sort_order ?? 0) + 1;

      const { data, error } = await supabase
        .from('company_categories')
        .insert({ name: name.trim(), sort_order: nextOrder, is_active: true })
        .select()
        .single();
      
      if (error) throw error;
      return data as CompanyCategory;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['company-categories'] });
      toast.success('Category created');
    },
    onError: (error: Error) => {
      toast.error(error.message || 'Failed to create category');
    },
  });
}

export function useUpdateCompanyCategory() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, ...updates }: Partial<CompanyCategory> & { id: string }) => {
      const { data, error } = await supabase
        .from('company_categories')
        .update(updates)
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;
      return data as CompanyCategory;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['company-categories'] });
      toast.success('Category updated');
    },
    onError: (error: Error) => {
      toast.error(error.message || 'Failed to update category');
    },
  });
}
