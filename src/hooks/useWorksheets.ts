import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Database } from '@/integrations/supabase/types';

type Worksheet = Database['public']['Tables']['worksheets']['Row'];
type WorksheetItem = Database['public']['Tables']['worksheet_items']['Row'];
type WorkflowTemplate = Database['public']['Tables']['workflow_templates']['Row'];
type WorkflowTemplateItem = Database['public']['Tables']['workflow_template_items']['Row'];

export interface WorksheetWithItems extends Worksheet {
  items: WorksheetItem[];
}

export function useEventWorksheets(eventId: string | undefined) {
  return useQuery({
    queryKey: ['worksheets', eventId],
    queryFn: async () => {
      if (!eventId) return [];
      
      const { data: worksheets, error } = await supabase
        .from('worksheets')
        .select('*')
        .eq('event_id', eventId)
        .order('phase');
      
      if (error) throw error;
      return worksheets as Worksheet[];
    },
    enabled: !!eventId,
  });
}

export function useWorksheetItems(worksheetId: string | undefined) {
  return useQuery({
    queryKey: ['worksheet-items', worksheetId],
    queryFn: async () => {
      if (!worksheetId) return [];
      
      const { data, error } = await supabase
        .from('worksheet_items')
        .select('*')
        .eq('worksheet_id', worksheetId)
        .order('sort_order');
      
      if (error) throw error;
      return data as WorksheetItem[];
    },
    enabled: !!worksheetId,
  });
}

export function useAllWorksheetItems(worksheetIds: string[]) {
  return useQuery({
    queryKey: ['worksheet-items-all', worksheetIds],
    queryFn: async () => {
      if (worksheetIds.length === 0) return [];
      
      const { data, error } = await supabase
        .from('worksheet_items')
        .select('*')
        .in('worksheet_id', worksheetIds)
        .order('sort_order');
      
      if (error) throw error;
      return data as WorksheetItem[];
    },
    enabled: worksheetIds.length > 0,
  });
}

export function useWorkflowTemplates() {
  return useQuery({
    queryKey: ['workflow-templates'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('workflow_templates')
        .select('*')
        .eq('is_active', true)
        .order('phase');
      
      if (error) throw error;
      return data as WorkflowTemplate[];
    },
  });
}

export function useWorkflowTemplateItems(templateIds: string[]) {
  return useQuery({
    queryKey: ['workflow-template-items', templateIds],
    queryFn: async () => {
      if (templateIds.length === 0) return [];
      
      const { data, error } = await supabase
        .from('workflow_template_items')
        .select('*')
        .in('template_id', templateIds)
        .order('sort_order');
      
      if (error) throw error;
      return data as WorkflowTemplateItem[];
    },
    enabled: templateIds.length > 0,
  });
}

export function useUpdateWorksheetItem() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async ({ 
      itemId, 
      isDone, 
      doneBy,
      notes
    }: { 
      itemId: string; 
      isDone: boolean;
      doneBy?: string;
      notes?: string;
    }) => {
      const { error } = await supabase
        .from('worksheet_items')
        .update({
          is_done: isDone,
          done_at: isDone ? new Date().toISOString() : null,
          done_by: isDone ? doneBy : null,
          notes: notes,
        })
        .eq('id', itemId);
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['worksheet-items'] });
      queryClient.invalidateQueries({ queryKey: ['worksheet-items-all'] });
    },
  });
}

export function useCreateWorksheetFromTemplate() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async ({ 
      eventId, 
      templateId 
    }: { 
      eventId: string; 
      templateId: string;
    }) => {
      // Get template details
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
        .order('sort_order');
      
      if (itemsError) throw itemsError;
      
      // Create worksheet
      const { data: worksheet, error: worksheetError } = await supabase
        .from('worksheets')
        .insert({
          event_id: eventId,
          template_id: templateId,
          template_name: template.template_name,
          phase: template.phase,
        })
        .select()
        .single();
      
      if (worksheetError) throw worksheetError;
      
      // Create worksheet items from template
      if (templateItems && templateItems.length > 0) {
        const items = templateItems.map((item) => ({
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
      
      return worksheet;
    },
    onSuccess: (_, { eventId }) => {
      queryClient.invalidateQueries({ queryKey: ['worksheets', eventId] });
    },
  });
}

export function useDeleteWorksheet() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async (worksheetId: string) => {
      const { error } = await supabase
        .from('worksheets')
        .delete()
        .eq('id', worksheetId);
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['worksheets'] });
    },
  });
}
