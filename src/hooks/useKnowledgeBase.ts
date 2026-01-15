import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

export interface KnowledgeArticle {
  id: string;
  title: string;
  category: string;
  content: string;
  is_active: boolean;
  sort_order: number;
  created_at: string;
  updated_at: string;
  created_by: string | null;
}

export function useKnowledgeArticles() {
  return useQuery({
    queryKey: ['knowledge-base'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('knowledge_base')
        .select('*')
        .order('category')
        .order('sort_order');
      
      if (error) throw error;
      return data as KnowledgeArticle[];
    },
  });
}

export function useKnowledgeArticle(id: string | undefined) {
  return useQuery({
    queryKey: ['knowledge-base', id],
    queryFn: async () => {
      if (!id) return null;
      const { data, error } = await supabase
        .from('knowledge_base')
        .select('*')
        .eq('id', id)
        .single();
      
      if (error) throw error;
      return data as KnowledgeArticle;
    },
    enabled: !!id,
  });
}

export function useKnowledgeCategories() {
  return useQuery({
    queryKey: ['knowledge-categories'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('knowledge_base')
        .select('category')
        .eq('is_active', true);
      
      if (error) throw error;
      
      // Get unique categories
      const categories = [...new Set(data.map(item => item.category))];
      return categories.sort();
    },
  });
}

export function useCreateKnowledgeArticle() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async (article: Omit<KnowledgeArticle, 'id' | 'created_at' | 'updated_at'>) => {
      const { data, error } = await supabase
        .from('knowledge_base')
        .insert(article)
        .select()
        .single();
      
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['knowledge-base'] });
      queryClient.invalidateQueries({ queryKey: ['knowledge-categories'] });
      toast.success('Article created');
    },
    onError: (error) => {
      toast.error('Failed to create article');
      console.error(error);
    },
  });
}

export function useUpdateKnowledgeArticle() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async ({ id, ...updates }: Partial<KnowledgeArticle> & { id: string }) => {
      const { data, error } = await supabase
        .from('knowledge_base')
        .update(updates)
        .eq('id', id)
        .select()
        .single();
      
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['knowledge-base'] });
      queryClient.invalidateQueries({ queryKey: ['knowledge-categories'] });
      toast.success('Article updated');
    },
    onError: (error) => {
      toast.error('Failed to update article');
      console.error(error);
    },
  });
}

export function useDeleteKnowledgeArticle() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('knowledge_base')
        .delete()
        .eq('id', id);
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['knowledge-base'] });
      queryClient.invalidateQueries({ queryKey: ['knowledge-categories'] });
      toast.success('Article deleted');
    },
    onError: (error) => {
      toast.error('Failed to delete article');
      console.error(error);
    },
  });
}
