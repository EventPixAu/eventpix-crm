import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { toast } from 'sonner';

interface EventBriefTemplate {
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

// Fetch all active templates
export function useEventBriefTemplates() {
  return useQuery({
    queryKey: ['event-brief-templates'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('event_brief_templates')
        .select('*')
        .eq('is_active', true)
        .order('sort_order');
      
      if (error) throw error;
      return data as EventBriefTemplate[];
    },
  });
}

// Fetch all templates (including inactive) for admin
export function useAllEventBriefTemplates() {
  return useQuery({
    queryKey: ['event-brief-templates-all'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('event_brief_templates')
        .select('*')
        .order('sort_order');
      
      if (error) throw error;
      return data as EventBriefTemplate[];
    },
  });
}

// Fetch single template
export function useEventBriefTemplate(templateId: string | undefined) {
  return useQuery({
    queryKey: ['event-brief-template', templateId],
    queryFn: async () => {
      if (!templateId) return null;
      
      const { data, error } = await supabase
        .from('event_brief_templates')
        .select('*')
        .eq('id', templateId)
        .single();
      
      if (error) throw error;
      return data as EventBriefTemplate;
    },
    enabled: !!templateId,
  });
}

// Create template
export function useCreateEventBriefTemplate() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async (data: {
      name: string;
      description?: string;
      content: string;
      pdf_file_name?: string;
      pdf_file_path?: string;
    }) => {
      // Get max sort order
      const { data: existing } = await supabase
        .from('event_brief_templates')
        .select('sort_order')
        .order('sort_order', { ascending: false })
        .limit(1);
      
      const maxOrder = existing?.[0]?.sort_order ?? -1;
      
      const { data: template, error } = await supabase
        .from('event_brief_templates')
        .insert({
          ...data,
          sort_order: maxOrder + 1,
        })
        .select()
        .single();
      
      if (error) throw error;
      return template;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['event-brief-templates'] });
      queryClient.invalidateQueries({ queryKey: ['event-brief-templates-all'] });
      toast.success('Brief template created');
    },
    onError: (error) => {
      toast.error('Failed to create template: ' + error.message);
    },
  });
}

// Update template
export function useUpdateEventBriefTemplate() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async ({ id, ...data }: {
      id: string;
      name?: string;
      description?: string | null;
      content?: string;
      is_active?: boolean;
      sort_order?: number;
      pdf_file_name?: string | null;
      pdf_file_path?: string | null;
    }) => {
      const { error } = await supabase
        .from('event_brief_templates')
        .update({ ...data, updated_at: new Date().toISOString() })
        .eq('id', id);
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['event-brief-templates'] });
      queryClient.invalidateQueries({ queryKey: ['event-brief-templates-all'] });
      queryClient.invalidateQueries({ queryKey: ['event-brief-template'] });
      toast.success('Brief template updated');
    },
    onError: (error) => {
      toast.error('Failed to update template: ' + error.message);
    },
  });
}

// Delete template
export function useDeleteEventBriefTemplate() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('event_brief_templates')
        .delete()
        .eq('id', id);
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['event-brief-templates'] });
      queryClient.invalidateQueries({ queryKey: ['event-brief-templates-all'] });
      toast.success('Brief template deleted');
    },
    onError: (error) => {
      toast.error('Failed to delete template: ' + error.message);
    },
  });
}

// Apply template to event
export function useApplyBriefToEvent() {
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
          brief_template_id: templateId,
          brief_content: content,
          brief_updated_at: new Date().toISOString(),
        })
        .eq('id', eventId);
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['event'] });
      queryClient.invalidateQueries({ queryKey: ['events'] });
      toast.success('Brief updated');
    },
    onError: (error) => {
      toast.error('Failed to update brief: ' + error.message);
    },
  });
}
