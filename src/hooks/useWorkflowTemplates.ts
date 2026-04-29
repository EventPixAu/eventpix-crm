import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { Database } from '@/integrations/supabase/types';
import { toast } from 'sonner';

type WorkflowTemplate = Database['public']['Tables']['workflow_templates']['Row'];
type WorkflowTemplateItem = Database['public']['Tables']['workflow_template_items']['Row'];

export type WorkflowDomain = 'sales' | 'operations';

export interface WorkflowTemplateWithItems extends WorkflowTemplate {
  items: WorkflowTemplateItem[];
  item_count: number;
}

// Fetch all templates (including inactive for admin), optionally filtered by domain
export function useAllWorkflowTemplates(domain?: WorkflowDomain) {
  return useQuery({
    queryKey: ['workflow-templates-all', domain],
    queryFn: async () => {
      let query = supabase
        .from('workflow_templates')
        .select('*')
        .order('phase')
        .order('sort_order')
        .order('template_name');
      
      if (domain) {
        query = query.eq('workflow_domain', domain);
      }
      
      const { data, error } = await query;
      if (error) throw error;
      return data as WorkflowTemplate[];
    },
  });
}

// Fetch single template
export function useWorkflowTemplate(templateId: string | undefined) {
  return useQuery({
    queryKey: ['workflow-template', templateId],
    queryFn: async () => {
      if (!templateId) return null;
      
      const { data, error } = await supabase
        .from('workflow_templates')
        .select('*')
        .eq('id', templateId)
        .single();
      
      if (error) throw error;
      return data as WorkflowTemplate;
    },
    enabled: !!templateId,
  });
}

// Fetch all template items (including inactive)
export function useAllTemplateItems(templateId: string | undefined) {
  return useQuery({
    queryKey: ['workflow-template-items-all', templateId],
    queryFn: async () => {
      if (!templateId) return [];
      
      const { data, error } = await supabase
        .from('workflow_template_items')
        .select('*')
        .eq('template_id', templateId)
        .order('sort_order');
      
      if (error) throw error;
      return data as WorkflowTemplateItem[];
    },
    enabled: !!templateId,
  });
}

// Check if template has been used (has worksheets)
export function useTemplateUsageCount(templateId: string | undefined) {
  return useQuery({
    queryKey: ['template-usage-count', templateId],
    queryFn: async () => {
      if (!templateId) return 0;
      
      const { count, error } = await supabase
        .from('worksheets')
        .select('*', { count: 'exact', head: true })
        .eq('template_id', templateId);
      
      if (error) throw error;
      return count || 0;
    },
    enabled: !!templateId,
  });
}

// Get events using this template (via worksheets)
export function useTemplateEvents(templateId: string | undefined) {
  return useQuery({
    queryKey: ['template-events', templateId],
    queryFn: async () => {
      if (!templateId) return [];
      
      const { data, error } = await supabase
        .from('worksheets')
        .select(`
          id,
          event_id,
          events:event_id (
            id,
            event_name,
            event_date,
            client_name
          )
        `)
        .eq('template_id', templateId);
      
      if (error) throw error;
      return data?.map(w => ({
        worksheetId: w.id,
        eventId: w.event_id,
        ...(w.events as { id: string; event_name: string; event_date: string; client_name: string })
      })) || [];
    },
    enabled: !!templateId,
  });
}

// Create template
export function useCreateTemplate() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async (data: { 
      template_name: string; 
      phase: 'pre_event' | 'day_of' | 'post_event';
      workflow_domain?: WorkflowDomain;
    }) => {
      const { data: template, error } = await supabase
        .from('workflow_templates')
        .insert({
          ...data,
          workflow_domain: data.workflow_domain || 'operations',
        })
        .select()
        .single();
      
      if (error) throw error;
      return template;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['workflow-templates'] });
      queryClient.invalidateQueries({ queryKey: ['workflow-templates-all'] });
      toast.success('Template created successfully');
    },
    onError: (error) => {
      toast.error('Failed to create template: ' + error.message);
    },
  });
}

// Update template
export function useUpdateTemplate() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async ({ 
      id, 
      ...data 
    }: { 
      id: string; 
      template_name?: string; 
      phase?: 'pre_event' | 'day_of' | 'post_event';
      is_active?: boolean;
      workflow_domain?: WorkflowDomain;
      sort_order?: number;
    }) => {
      const { error } = await supabase
        .from('workflow_templates')
        .update({ ...data, updated_at: new Date().toISOString() })
        .eq('id', id);
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['workflow-templates'] });
      queryClient.invalidateQueries({ queryKey: ['workflow-templates-all'] });
      queryClient.invalidateQueries({ queryKey: ['workflow-template'] });
      toast.success('Template updated successfully');
    },
    onError: (error) => {
      toast.error('Failed to update template: ' + error.message);
    },
  });
}

// Reorder templates within a phase
export function useReorderTemplates() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async (templates: { id: string; sort_order: number }[]) => {
      for (const template of templates) {
        const { error } = await supabase
          .from('workflow_templates')
          .update({ sort_order: template.sort_order })
          .eq('id', template.id);
        
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['workflow-templates'] });
      queryClient.invalidateQueries({ queryKey: ['workflow-templates-all'] });
    },
    onError: (error) => {
      toast.error('Failed to reorder templates: ' + error.message);
    },
  });
}
export function useDuplicateTemplate() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async (templateId: string) => {
      // Get original template
      const { data: original, error: fetchError } = await supabase
        .from('workflow_templates')
        .select('*')
        .eq('id', templateId)
        .single();
      
      if (fetchError) throw fetchError;
      
      // Create new template
      const { data: newTemplate, error: createError } = await supabase
        .from('workflow_templates')
        .insert({
          template_name: `${original.template_name} (Copy)`,
          phase: original.phase,
          is_active: false, // Start as inactive
        })
        .select()
        .single();
      
      if (createError) throw createError;
      
      // Get original items
      const { data: items, error: itemsError } = await supabase
        .from('workflow_template_items')
        .select('*')
        .eq('template_id', templateId)
        .order('sort_order');
      
      if (itemsError) throw itemsError;
      
      // Copy items to new template
      if (items && items.length > 0) {
        const newItems = items.map(item => ({
          template_id: newTemplate.id,
          label: item.label,
          help_text: item.help_text,
          sort_order: item.sort_order,
          is_active: item.is_active ?? true,
        }));
        
        const { error: insertError } = await supabase
          .from('workflow_template_items')
          .insert(newItems);
        
        if (insertError) throw insertError;
      }
      
      return newTemplate;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['workflow-templates'] });
      queryClient.invalidateQueries({ queryKey: ['workflow-templates-all'] });
      toast.success('Template duplicated successfully');
    },
    onError: (error) => {
      toast.error('Failed to duplicate template: ' + error.message);
    },
  });
}

// Create template item
export function useCreateTemplateItem() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async (data: { 
      template_id: string; 
      label: string; 
      help_text?: string;
      sort_order: number;
    }) => {
      const { data: item, error } = await supabase
        .from('workflow_template_items')
        .insert(data)
        .select()
        .single();
      
      if (error) throw error;
      return item;
    },
    onSuccess: (_, { template_id }) => {
      queryClient.invalidateQueries({ queryKey: ['workflow-template-items-all', template_id] });
      queryClient.invalidateQueries({ queryKey: ['workflow-template-items'] });
    },
    onError: (error) => {
      toast.error('Failed to add item: ' + error.message);
    },
  });
}

// Update template item
export function useUpdateTemplateItem() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async ({ 
      id, 
      template_id,
      ...data 
    }: { 
      id: string;
      template_id: string;
      label?: string; 
      help_text?: string | null;
      sort_order?: number;
      is_active?: boolean;
      date_offset_reference?: string | null;
      date_offset_days?: number | null;
    }) => {
      const { error } = await supabase
        .from('workflow_template_items')
        .update(data)
        .eq('id', id);
      
      if (error) throw error;
    },
    onSuccess: (_, { template_id }) => {
      queryClient.invalidateQueries({ queryKey: ['workflow-template-items-all', template_id] });
      queryClient.invalidateQueries({ queryKey: ['workflow-template-items'] });
    },
    onError: (error) => {
      toast.error('Failed to update item: ' + error.message);
    },
  });
}

// Delete template item (only if template not used)
export function useDeleteTemplateItem() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async ({ id, template_id }: { id: string; template_id: string }) => {
      const { error } = await supabase
        .from('workflow_template_items')
        .delete()
        .eq('id', id);
      
      if (error) throw error;
    },
    onSuccess: (_, { template_id }) => {
      queryClient.invalidateQueries({ queryKey: ['workflow-template-items-all', template_id] });
      queryClient.invalidateQueries({ queryKey: ['workflow-template-items'] });
    },
    onError: (error) => {
      toast.error('Failed to delete item: ' + error.message);
    },
  });
}

// Reorder items
export function useReorderTemplateItems() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async ({ 
      template_id, 
      items 
    }: { 
      template_id: string;
      items: { id: string; sort_order: number }[];
    }) => {
      // Update each item's sort_order
      for (const item of items) {
        const { error } = await supabase
          .from('workflow_template_items')
          .update({ sort_order: item.sort_order })
          .eq('id', item.id);
        
        if (error) throw error;
      }
    },
    onSuccess: (_, { template_id }) => {
      queryClient.invalidateQueries({ queryKey: ['workflow-template-items-all', template_id] });
      queryClient.invalidateQueries({ queryKey: ['workflow-template-items'] });
    },
    onError: (error) => {
      toast.error('Failed to reorder items: ' + error.message);
    },
  });
}

// Bulk apply template to existing events
export function useBulkApplyTemplate() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async ({ 
      templateId, 
      afterDate,
      eventTypeIds,
    }: { 
      templateId: string;
      afterDate?: string;
      eventTypeIds?: string[];
    }) => {
      // Get template
      const { data: template, error: templateError } = await supabase
        .from('workflow_templates')
        .select('*')
        .eq('id', templateId)
        .single();
      
      if (templateError) throw templateError;
      
      // Get template items
      const { data: templateItems, error: itemsError } = await supabase
        .from('workflow_template_items')
        .select('*')
        .eq('template_id', templateId)
        .eq('is_active', true)
        .order('sort_order');
      
      if (itemsError) throw itemsError;
      
      // Build events query
      let eventsQuery = supabase
        .from('events')
        .select('id, event_date');
      
      if (afterDate) {
        eventsQuery = eventsQuery.gte('event_date', afterDate);
      }
      
      if (eventTypeIds && eventTypeIds.length > 0) {
        eventsQuery = eventsQuery.in('event_type_id', eventTypeIds);
      }
      
      const { data: events, error: eventsError } = await eventsQuery;
      if (eventsError) throw eventsError;
      
      // Get existing worksheets with this template
      const { data: existingWorksheets, error: existingError } = await supabase
        .from('worksheets')
        .select('event_id')
        .eq('template_id', templateId);
      
      if (existingError) throw existingError;
      
      const existingEventIds = new Set(existingWorksheets?.map(w => w.event_id) || []);
      
      // Filter to events that don't have this worksheet
      const eventsToApply = events?.filter(e => !existingEventIds.has(e.id)) || [];
      
      let created = 0;
      let skipped = events ? events.length - eventsToApply.length : 0;
      
      // Create worksheets for each event
      for (const event of eventsToApply) {
        // Create worksheet
        const { data: worksheet, error: wsError } = await supabase
          .from('worksheets')
          .insert({
            event_id: event.id,
            template_id: templateId,
            template_name: template.template_name,
            phase: template.phase,
            status: 'not_started',
          })
          .select()
          .single();
        
        if (wsError) throw wsError;
        
        // Create worksheet items
        if (templateItems && templateItems.length > 0) {
          const items = templateItems.map(item => ({
            worksheet_id: worksheet.id,
            item_text: item.label,
            template_item_id: item.id,
            sort_order: item.sort_order,
            is_done: false,
          }));
          
          const { error: insertError } = await supabase
            .from('worksheet_items')
            .insert(items);
          
          if (insertError) throw insertError;
        }
        
        created++;
      }
      
      return {
        matched: events?.length || 0,
        created,
        skipped,
      };
    },
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ['worksheets'] });
      toast.success(`Applied to ${result.created} events (${result.skipped} skipped)`);
    },
    onError: (error) => {
      toast.error('Failed to apply template: ' + error.message);
    },
  });
}
