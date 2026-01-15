/**
 * QUOTE TEMPLATES HOOKS
 * 
 * Provides data access for Quote Templates.
 * Access restricted to: Admin, Sales roles (enforced via RLS)
 */
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

// Types
export interface QuoteTemplateItem {
  product_id?: string | null;
  description: string;
  quantity: number;
  unit_price: number;
  tax_rate: number;
}

export interface QuoteTemplate {
  id: string;
  name: string;
  description: string | null;
  terms_text: string | null;
  items_json: QuoteTemplateItem[];
  is_active: boolean;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface QuoteTemplateInsert {
  name: string;
  description?: string | null;
  terms_text?: string | null;
  items_json: QuoteTemplateItem[];
  is_active?: boolean;
}

export interface QuoteTemplateUpdate extends Partial<QuoteTemplateInsert> {
  id: string;
}

// =============================================================
// QUOTE TEMPLATE HOOKS
// =============================================================

// Helper to safely cast items_json from Json to QuoteTemplateItem[]
function parseItemsJson(data: any): QuoteTemplateItem[] {
  if (Array.isArray(data)) {
    return data as QuoteTemplateItem[];
  }
  return [];
}

function mapTemplate(data: any): QuoteTemplate {
  return {
    ...data,
    items_json: parseItemsJson(data.items_json),
  };
}

export function useQuoteTemplates() {
  return useQuery({
    queryKey: ['quote-templates'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('quote_templates')
        .select('*')
        .order('name', { ascending: true });
      
      if (error) throw error;
      return (data || []).map(mapTemplate) as QuoteTemplate[];
    },
  });
}

export function useActiveQuoteTemplates() {
  return useQuery({
    queryKey: ['quote-templates', 'active'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('quote_templates')
        .select('*')
        .eq('is_active', true)
        .order('name', { ascending: true });
      
      if (error) throw error;
      return (data || []).map(mapTemplate) as QuoteTemplate[];
    },
  });
}

export function useQuoteTemplate(id: string | undefined) {
  return useQuery({
    queryKey: ['quote-templates', id],
    queryFn: async () => {
      if (!id) return null;
      const { data, error } = await supabase
        .from('quote_templates')
        .select('*')
        .eq('id', id)
        .single();
      
      if (error) throw error;
      return mapTemplate(data) as QuoteTemplate;
    },
    enabled: !!id,
  });
}

export function useCreateQuoteTemplate() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (template: QuoteTemplateInsert) => {
      const { data: user } = await supabase.auth.getUser();
      const { data, error } = await supabase
        .from('quote_templates')
        .insert({
          name: template.name,
          description: template.description,
          terms_text: template.terms_text,
          items_json: template.items_json as unknown as any,
          is_active: template.is_active,
          created_by: user?.user?.id,
        })
        .select()
        .single();
      
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['quote-templates'] });
      toast({ title: 'Template created successfully' });
    },
    onError: (error: Error) => {
      toast({ title: 'Failed to create template', description: error.message, variant: 'destructive' });
    },
  });
}

export function useUpdateQuoteTemplate() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async ({ id, ...updates }: QuoteTemplateUpdate) => {
      // Build update object with proper typing
      const updatePayload: Record<string, any> = {};
      if (updates.name !== undefined) updatePayload.name = updates.name;
      if (updates.description !== undefined) updatePayload.description = updates.description;
      if (updates.terms_text !== undefined) updatePayload.terms_text = updates.terms_text;
      if (updates.is_active !== undefined) updatePayload.is_active = updates.is_active;
      if (updates.items_json !== undefined) updatePayload.items_json = updates.items_json;
      
      const { data, error } = await supabase
        .from('quote_templates')
        .update(updatePayload)
        .eq('id', id)
        .select()
        .single();
      
      if (error) throw error;
      return data;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['quote-templates'] });
      queryClient.invalidateQueries({ queryKey: ['quote-templates', variables.id] });
      toast({ title: 'Template updated successfully' });
    },
    onError: (error: Error) => {
      toast({ title: 'Failed to update template', description: error.message, variant: 'destructive' });
    },
  });
}

export function useDeleteQuoteTemplate() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('quote_templates')
        .delete()
        .eq('id', id);
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['quote-templates'] });
      toast({ title: 'Template deleted successfully' });
    },
    onError: (error: Error) => {
      toast({ title: 'Failed to delete template', description: error.message, variant: 'destructive' });
    },
  });
}

/**
 * Create a template from an existing quote
 */
export function useCreateTemplateFromQuote() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async ({ 
      quoteId, 
      templateName, 
      templateDescription 
    }: { 
      quoteId: string; 
      templateName: string; 
      templateDescription?: string;
    }) => {
      // Fetch quote and its items
      const { data: quote, error: quoteError } = await supabase
        .from('quotes')
        .select('terms_text')
        .eq('id', quoteId)
        .single();
      
      if (quoteError) throw quoteError;

      const { data: items, error: itemsError } = await supabase
        .from('quote_items')
        .select('product_id, description, quantity, unit_price, tax_rate')
        .eq('quote_id', quoteId)
        .order('sort_order', { ascending: true });
      
      if (itemsError) throw itemsError;

      // Create template
      const { data: user } = await supabase.auth.getUser();
      const { data, error } = await supabase
        .from('quote_templates')
        .insert({
          name: templateName,
          description: templateDescription || null,
          terms_text: quote?.terms_text || null,
          items_json: items || [],
          created_by: user?.user?.id,
        })
        .select()
        .single();
      
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['quote-templates'] });
      toast({ title: 'Template created from quote' });
    },
    onError: (error: Error) => {
      toast({ title: 'Failed to create template', description: error.message, variant: 'destructive' });
    },
  });
}
