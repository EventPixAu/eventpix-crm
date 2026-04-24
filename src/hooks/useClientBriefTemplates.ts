import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

interface ClientBriefTemplate {
  id: string;
  name: string;
  description: string | null;
  content: string;
  is_active: boolean;
  sort_order: number;
  pdf_file_name: string | null;
  pdf_file_path: string | null;
  created_at: string;
  updated_at: string;
}

export function useClientBriefTemplates() {
  return useQuery({
    queryKey: ['client-brief-templates'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('client_brief_templates')
        .select('*')
        .eq('is_active', true)
        .order('sort_order');
      if (error) throw error;
      return data as ClientBriefTemplate[];
    },
  });
}

export function useAllClientBriefTemplates() {
  return useQuery({
    queryKey: ['client-brief-templates-all'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('client_brief_templates')
        .select('*')
        .order('sort_order');
      if (error) throw error;
      return data as ClientBriefTemplate[];
    },
  });
}

export function useCreateClientBriefTemplate() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (data: { name: string; description?: string; content: string; pdf_file_name?: string; pdf_file_path?: string }) => {
      const { data: existing } = await supabase
        .from('client_brief_templates')
        .select('sort_order')
        .order('sort_order', { ascending: false })
        .limit(1);
      const maxOrder = existing?.[0]?.sort_order ?? -1;
      const { data: template, error } = await supabase
        .from('client_brief_templates')
        .insert({ ...data, sort_order: maxOrder + 1 })
        .select()
        .single();
      if (error) throw error;
      return template;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['client-brief-templates'] });
      queryClient.invalidateQueries({ queryKey: ['client-brief-templates-all'] });
      toast.success('Event brief template created');
    },
    onError: (error) => toast.error('Failed to create template: ' + error.message),
  });
}

export function useUpdateClientBriefTemplate() {
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
        .from('client_brief_templates')
        .update({ ...data, updated_at: new Date().toISOString() })
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['client-brief-templates'] });
      queryClient.invalidateQueries({ queryKey: ['client-brief-templates-all'] });
      toast.success('Event brief template updated');
    },
    onError: (error) => toast.error('Failed to update template: ' + error.message),
  });
}

export function useDeleteClientBriefTemplate() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('client_brief_templates')
        .delete()
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['client-brief-templates'] });
      queryClient.invalidateQueries({ queryKey: ['client-brief-templates-all'] });
      toast.success('Event brief template deleted');
    },
    onError: (error) => toast.error('Failed to delete template: ' + error.message),
  });
}

export function useApplyClientBriefToEvent() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ eventId, templateId, content }: {
      eventId: string;
      templateId: string | null;
      content: string | null;
    }) => {
      const { error } = await supabase
        .from('events')
        .update({
          client_brief_template_id: templateId,
          client_brief_content: content,
        })
        .eq('id', eventId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['event'] });
      queryClient.invalidateQueries({ queryKey: ['events'] });
      toast.success('Event brief updated');
    },
    onError: (error) => toast.error('Failed to update event brief: ' + error.message),
  });
}
