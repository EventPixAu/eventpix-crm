import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { toast } from 'sonner';

export interface EditingInstructionTemplate {
  id: string;
  name: string;
  description: string | null;
  content: string;
  is_active: boolean;
  sort_order: number;
  created_at: string;
  updated_at: string;
}

export function useEditingInstructionTemplates() {
  return useQuery({
    queryKey: ['editing-instruction-templates'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('editing_instruction_templates')
        .select('*')
        .eq('is_active', true)
        .order('sort_order');
      if (error) throw error;
      return data as EditingInstructionTemplate[];
    },
  });
}

export function useAllEditingInstructionTemplates() {
  return useQuery({
    queryKey: ['editing-instruction-templates-all'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('editing_instruction_templates')
        .select('*')
        .order('sort_order');
      if (error) throw error;
      return data as EditingInstructionTemplate[];
    },
  });
}

export function useCreateEditingInstructionTemplate() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (data: { name: string; description?: string; content: string }) => {
      const { data: existing } = await supabase
        .from('editing_instruction_templates')
        .select('sort_order')
        .order('sort_order', { ascending: false })
        .limit(1);
      const maxOrder = existing?.[0]?.sort_order ?? -1;
      const { data: template, error } = await supabase
        .from('editing_instruction_templates')
        .insert({ ...data, sort_order: maxOrder + 1 })
        .select()
        .single();
      if (error) throw error;
      return template;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['editing-instruction-templates'] });
      queryClient.invalidateQueries({ queryKey: ['editing-instruction-templates-all'] });
      toast.success('Editing instruction template created');
    },
    onError: (error) => toast.error('Failed to create template: ' + error.message),
  });
}

export function useUpdateEditingInstructionTemplate() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...data }: {
      id: string;
      name?: string;
      description?: string | null;
      content?: string;
      is_active?: boolean;
      sort_order?: number;
    }) => {
      const { error } = await supabase
        .from('editing_instruction_templates')
        .update({ ...data, updated_at: new Date().toISOString() })
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['editing-instruction-templates'] });
      queryClient.invalidateQueries({ queryKey: ['editing-instruction-templates-all'] });
      toast.success('Template updated');
    },
    onError: (error) => toast.error('Failed to update template: ' + error.message),
  });
}

export function useDeleteEditingInstructionTemplate() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('editing_instruction_templates')
        .delete()
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['editing-instruction-templates'] });
      queryClient.invalidateQueries({ queryKey: ['editing-instruction-templates-all'] });
      toast.success('Template deleted');
    },
    onError: (error) => toast.error('Failed to delete template: ' + error.message),
  });
}
