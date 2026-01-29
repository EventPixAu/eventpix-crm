/**
 * COMPANY CATEGORIES HOOK
 * 
 * Provides access to company category lookup data
 */
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

interface CompanyCategory {
  id: string;
  name: string;
  sort_order: number;
  is_active: boolean;
}

export function useCompanyCategories() {
  return useQuery({
    queryKey: ['company-categories'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('company_categories')
        .select('*')
        .eq('is_active', true)
        .order('sort_order', { ascending: true });
      
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
