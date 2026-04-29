/**
 * ADMIN PRODUCT CATEGORIES HOOK
 * 
 * Provides CRUD operations for product category lookup management.
 * Access restricted to: Admin role (enforced via RLS)
 */
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { toast } from 'sonner';
import type { LookupItem } from '@/hooks/useAdminLookups';

export interface ProductCategory extends LookupItem {
  created_at?: string;
}

export function useAllProductCategories() {
  return useQuery({
    queryKey: ['product-categories', 'all'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('product_categories')
        .select('*')
        .order('name')
        .order('sort_order');
      
      if (error) throw error;
      return data as ProductCategory[];
    },
  });
}

export function useCreateProductCategory() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (name: string) => {
      // Get max sort_order
      const { data: maxData } = await supabase
        .from('product_categories')
        .select('sort_order')
        .order('sort_order', { ascending: false })
        .limit(1)
        .single();
      
      const nextOrder = (maxData?.sort_order || 0) + 1;

      const { data, error } = await supabase
        .from('product_categories')
        .insert({ name, sort_order: nextOrder, is_active: true })
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['product-categories'] });
      toast.success('Product category created');
    },
    onError: (error) => {
      toast.error('Failed to create: ' + error.message);
    },
  });
}

export function useUpdateProductCategory() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, ...updates }: Partial<ProductCategory> & { id: string }) => {
      const { data, error } = await supabase
        .from('product_categories')
        .update(updates)
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['product-categories'] });
      toast.success('Product category updated');
    },
    onError: (error) => {
      toast.error('Failed to update: ' + error.message);
    },
  });
}
