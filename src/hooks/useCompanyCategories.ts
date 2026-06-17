/**
 * COMPANY CATEGORIES + SUBCATEGORIES
 *
 * Two-level Parent → Sub-category structure.
 * `company_categories` holds parents (is_parent=true).
 * `company_subcategories` holds child rows linked by parent_id.
 */
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { toast } from 'sonner';

export interface CompanyCategory {
  id: string;
  name: string;
  sort_order: number;
  is_active: boolean;
  is_parent?: boolean;
  excluded_from_campaigns?: boolean;
}

export interface CompanySubcategory {
  id: string;
  parent_id: string;
  name: string;
  sort_order: number;
  is_active: boolean;
}

// Parents only (active)
export function useCompanyCategories() {
  return useQuery({
    queryKey: ['company-categories'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('company_categories')
        .select('*')
        .eq('is_active', true)
        .order('sort_order', { ascending: true })
        .order('name', { ascending: true });
      if (error) throw error;
      return (data || []).filter((c: any) => c.is_parent !== false) as CompanyCategory[];
    },
  });
}

// All parents (admin)
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
      return (data || []).filter((c: any) => c.is_parent !== false) as CompanyCategory[];
    },
  });
}

// Subcategories — optionally filtered by parent
export function useCompanySubcategories(parentId?: string | null) {
  return useQuery({
    queryKey: ['company-subcategories', parentId ?? 'all'],
    queryFn: async () => {
      let q = supabase
        .from('company_subcategories' as any)
        .select('*')
        .eq('is_active', true)
        .order('sort_order')
        .order('name');
      if (parentId) q = q.eq('parent_id', parentId);
      const { data, error } = await q;
      if (error) throw error;
      return (data || []) as unknown as CompanySubcategory[];
    },
  });
}

// All subcategories (admin)
export function useAllCompanySubcategories() {
  return useQuery({
    queryKey: ['company-subcategories', 'admin-all'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('company_subcategories' as any)
        .select('*')
        .order('sort_order')
        .order('name');
      if (error) throw error;
      return (data || []) as unknown as CompanySubcategory[];
    },
  });
}

export function useCreateCompanyCategory() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (name: string) => {
      const { data: existing } = await supabase
        .from('company_categories')
        .select('sort_order')
        .order('sort_order', { ascending: false })
        .limit(1);
      const nextOrder = (existing?.[0]?.sort_order ?? 0) + 1;
      const { data, error } = await supabase
        .from('company_categories')
        .insert({ name: name.trim(), sort_order: nextOrder, is_active: true, is_parent: true } as any)
        .select()
        .single();
      if (error) throw error;
      return data as CompanyCategory;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['company-categories'] });
      toast.success('Parent category created');
    },
    onError: (e: Error) => toast.error(e.message || 'Failed to create category'),
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
    onError: (e: Error) => toast.error(e.message || 'Failed to update category'),
  });
}

export function useCreateCompanySubcategory() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ parent_id, name }: { parent_id: string; name: string }) => {
      const { data: existing } = await supabase
        .from('company_subcategories' as any)
        .select('sort_order')
        .eq('parent_id', parent_id)
        .order('sort_order', { ascending: false })
        .limit(1);
      const nextOrder = ((existing as any)?.[0]?.sort_order ?? 0) + 1;
      const { data, error } = await supabase
        .from('company_subcategories' as any)
        .insert({ parent_id, name: name.trim(), sort_order: nextOrder, is_active: true } as any)
        .select()
        .single();
      if (error) throw error;
      return data as unknown as CompanySubcategory;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['company-subcategories'] });
      toast.success('Sub-category created');
    },
    onError: (e: Error) => toast.error(e.message || 'Failed to create sub-category'),
  });
}

export function useUpdateCompanySubcategory() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...updates }: Partial<CompanySubcategory> & { id: string }) => {
      const { data, error } = await supabase
        .from('company_subcategories' as any)
        .update(updates)
        .eq('id', id)
        .select()
        .single();
      if (error) throw error;
      return data as unknown as CompanySubcategory;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['company-subcategories'] });
      toast.success('Sub-category updated');
    },
    onError: (e: Error) => toast.error(e.message || 'Failed to update sub-category'),
  });
}
