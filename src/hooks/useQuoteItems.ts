/**
 * QUOTE ITEMS HOOKS
 * 
 * Provides data access for Quote Line Items.
 * Access restricted to: Admin, Sales roles (enforced via RLS)
 */
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import type { Product } from '@/hooks/useProducts';

// Types
export interface QuoteItem {
  id: string;
  quote_id: string;
  product_id: string | null;
  description: string;
  quantity: number;
  unit_price: number;
  tax_rate: number;
  line_total: number;
  sort_order: number;
  group_label: string | null;
  discount_percent: number;
  discount_amount: number;
  is_package_item: boolean;
  package_source_id: string | null;
  created_at: string;
  product?: Product | null;
}

export interface QuoteItemInsert {
  quote_id: string;
  product_id?: string | null;
  description: string;
  quantity?: number;
  unit_price: number;
  tax_rate?: number;
  sort_order?: number;
  group_label?: string | null;
  discount_percent?: number;
  discount_amount?: number;
  is_package_item?: boolean;
  package_source_id?: string | null;
}

export interface QuoteItemUpdate extends Partial<Omit<QuoteItemInsert, 'quote_id'>> {
  id: string;
}

// =============================================================
// QUOTE ITEMS HOOKS
// =============================================================

export function useQuoteItems(quoteId: string | undefined) {
  return useQuery({
    queryKey: ['quote-items', quoteId],
    queryFn: async () => {
      if (!quoteId) return [];
      const { data, error } = await supabase
        .from('quote_items')
        .select(`
          *,
          product:products!quote_items_product_id_fkey(*)
        `)
        .eq('quote_id', quoteId)
        .order('sort_order', { ascending: true });
      
      if (error) throw error;
      return data as QuoteItem[];
    },
    enabled: !!quoteId,
  });
}

export function useCreateQuoteItem() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (item: QuoteItemInsert) => {
      const { data, error } = await supabase
        .from('quote_items')
        .insert(item)
        .select()
        .single();
      
      if (error) throw error;
      return data;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['quote-items', variables.quote_id] });
      queryClient.invalidateQueries({ queryKey: ['quotes'] });
      toast({ title: 'Item added successfully' });
    },
    onError: (error: Error) => {
      toast({ title: 'Failed to add item', description: error.message, variant: 'destructive' });
    },
  });
}

export function useUpdateQuoteItem() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async ({ id, ...updates }: QuoteItemUpdate & { quote_id: string }) => {
      const { data, error } = await supabase
        .from('quote_items')
        .update(updates)
        .eq('id', id)
        .select()
        .single();
      
      if (error) throw error;
      return data;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['quote-items', variables.quote_id] });
      queryClient.invalidateQueries({ queryKey: ['quotes'] });
    },
    onError: (error: Error) => {
      toast({ title: 'Failed to update item', description: error.message, variant: 'destructive' });
    },
  });
}

export function useDeleteQuoteItem() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async ({ id, quote_id }: { id: string; quote_id: string }) => {
      const { error } = await supabase
        .from('quote_items')
        .delete()
        .eq('id', id);
      
      if (error) throw error;
      return { quote_id };
    },
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ['quote-items', result.quote_id] });
      queryClient.invalidateQueries({ queryKey: ['quotes'] });
      toast({ title: 'Item removed successfully' });
    },
    onError: (error: Error) => {
      toast({ title: 'Failed to remove item', description: error.message, variant: 'destructive' });
    },
  });
}

export function useReorderQuoteItems() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ items, quote_id }: { items: { id: string; sort_order: number }[]; quote_id: string }) => {
      const updates = items.map(item => 
        supabase
          .from('quote_items')
          .update({ sort_order: item.sort_order })
          .eq('id', item.id)
      );
      
      await Promise.all(updates);
      return { quote_id };
    },
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ['quote-items', result.quote_id] });
    },
  });
}
