/**
 * PACKAGES HOOKS
 * 
 * Provides data access for Product Packages.
 * Packages are products that bundle multiple items together.
 * Access restricted to: Admin, Sales roles (enforced via RLS)
 */
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import type { Product } from '@/hooks/useProducts';

// Types
export interface PackageItem {
  id: string;
  package_id: string;
  product_id: string;
  quantity: number;
  sort_order: number;
  created_at: string;
  product?: Product;
}

export interface PackageWithItems extends Product {
  package_items?: PackageItem[];
}

// =============================================================
// PACKAGE HOOKS
// =============================================================

/**
 * Fetch all packages (products with is_package = true)
 */
export function usePackages() {
  return useQuery({
    queryKey: ['packages'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('products')
        .select(`
          *,
          category:product_categories(*)
        `)
        .eq('is_package', true)
        .order('name', { ascending: true });
      
      if (error) throw error;
      return data as Product[];
    },
  });
}

/**
 * Fetch active packages only
 */
export function useActivePackages() {
  return useQuery({
    queryKey: ['packages', 'active'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('products')
        .select(`
          *,
          category:product_categories(*)
        `)
        .eq('is_package', true)
        .eq('is_active', true)
        .order('name', { ascending: true });
      
      if (error) throw error;
      return data as Product[];
    },
  });
}

/**
 * Fetch a single package with its included items
 */
export function usePackageWithItems(packageId: string | undefined) {
  return useQuery({
    queryKey: ['packages', packageId, 'with-items'],
    queryFn: async () => {
      if (!packageId) return null;
      
      // Get the package
      const { data: packageData, error: packageError } = await supabase
        .from('products')
        .select(`
          *,
          category:product_categories(*)
        `)
        .eq('id', packageId)
        .eq('is_package', true)
        .single();
      
      if (packageError) throw packageError;
      
      // Get package items
      const { data: items, error: itemsError } = await supabase
        .from('package_items')
        .select(`
          *,
          product:products!package_items_product_id_fkey(*)
        `)
        .eq('package_id', packageId)
        .order('sort_order', { ascending: true });
      
      if (itemsError) throw itemsError;
      
      return {
        ...packageData,
        package_items: items,
      } as PackageWithItems;
    },
    enabled: !!packageId,
  });
}

/**
 * Fetch items within a package
 */
export function usePackageItems(packageId: string | undefined) {
  return useQuery({
    queryKey: ['package-items', packageId],
    queryFn: async () => {
      if (!packageId) return [];
      const { data, error } = await supabase
        .from('package_items')
        .select(`
          *,
          product:products!package_items_product_id_fkey(*)
        `)
        .eq('package_id', packageId)
        .order('sort_order', { ascending: true });
      
      if (error) throw error;
      return data as PackageItem[];
    },
    enabled: !!packageId,
  });
}

/**
 * Create a new package
 */
export function useCreatePackage() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (pkg: {
      name: string;
      description?: string;
      unit_price: number;
      tax_rate?: number;
      package_discount_percent?: number;
      package_discount_amount?: number;
    }) => {
      const { data, error } = await supabase
        .from('products')
        .insert({
          ...pkg,
          is_package: true,
          is_active: true,
        })
        .select()
        .single();
      
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['packages'] });
      queryClient.invalidateQueries({ queryKey: ['products'] });
      toast.success('Package created successfully');
    },
    onError: (error: Error) => {
      toast.error('Failed to create package', { description: error.message });
    },
  });
}

/**
 * Add an item to a package
 */
export function useAddPackageItem() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ package_id, product_id, quantity = 1 }: {
      package_id: string;
      product_id: string;
      quantity?: number;
    }) => {
      // Get max sort order
      const { data: existing } = await supabase
        .from('package_items')
        .select('sort_order')
        .eq('package_id', package_id)
        .order('sort_order', { ascending: false })
        .limit(1);
      
      const nextSort = (existing?.[0]?.sort_order ?? -1) + 1;
      
      const { data, error } = await supabase
        .from('package_items')
        .insert({
          package_id,
          product_id,
          quantity,
          sort_order: nextSort,
        })
        .select()
        .single();
      
      if (error) throw error;
      return data;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['package-items', variables.package_id] });
      queryClient.invalidateQueries({ queryKey: ['packages', variables.package_id, 'with-items'] });
      toast.success('Item added to package');
    },
    onError: (error: Error) => {
      toast.error('Failed to add item', { description: error.message });
    },
  });
}

/**
 * Remove an item from a package
 */
export function useRemovePackageItem() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, package_id }: { id: string; package_id: string }) => {
      const { error } = await supabase
        .from('package_items')
        .delete()
        .eq('id', id);
      
      if (error) throw error;
      return { package_id };
    },
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ['package-items', result.package_id] });
      queryClient.invalidateQueries({ queryKey: ['packages', result.package_id, 'with-items'] });
      toast.success('Item removed from package');
    },
    onError: (error: Error) => {
      toast.error('Failed to remove item', { description: error.message });
    },
  });
}

/**
 * Add a package to a quote using the database function
 */
export function useAddPackageToQuote() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ quote_id, package_id, quantity = 1 }: {
      quote_id: string;
      package_id: string;
      quantity?: number;
    }) => {
      const { data, error } = await supabase.rpc('add_package_to_quote', {
        p_quote_id: quote_id,
        p_package_id: package_id,
        p_quantity: quantity,
      });
      
      if (error) throw error;
      
      const result = data as unknown as { success: boolean; error?: string; items_added?: number; package_name?: string };
      if (!result.success) {
        throw new Error(result.error || 'Failed to add package');
      }
      
      return result;
    },
    onSuccess: (result, variables) => {
      queryClient.invalidateQueries({ queryKey: ['quote-items', variables.quote_id] });
      queryClient.invalidateQueries({ queryKey: ['quotes'] });
      toast.success('Package added', { description: `Added ${result.items_added} items from ${result.package_name}` });
    },
    onError: (error: Error) => {
      toast.error('Failed to add package', { description: error.message });
    },
  });
}
