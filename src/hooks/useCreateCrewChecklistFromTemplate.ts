/**
 * useCreateCrewChecklistFromTemplate - Create a checklist from a specific template
 */
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

export function useCreateCrewChecklistFromTemplate() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ 
      eventId, 
      userId,
      templateId,
    }: { 
      eventId: string; 
      userId: string;
      templateId: string;
    }) => {
      // Check if checklist already exists for this user/event
      const { data: existing } = await supabase
        .from('crew_checklists')
        .select('id')
        .eq('event_id', eventId)
        .eq('user_id', userId)
        .maybeSingle();
      
      if (existing) {
        throw new Error('Checklist already exists for this assignment');
      }

      // Fetch the selected template
      const { data: template, error: templateError } = await supabase
        .from('crew_checklist_templates')
        .select('id, items')
        .eq('id', templateId)
        .single();
      
      if (templateError) throw templateError;
      if (!template) throw new Error('Template not found');

      const templateItems = (template.items as { item_text: string; sort_order: number }[]) || [];

      // Create checklist
      const { data: checklist, error: checklistError } = await supabase
        .from('crew_checklists')
        .insert({
          event_id: eventId,
          user_id: userId,
          template_id: templateId,
        })
        .select()
        .single();

      if (checklistError) throw checklistError;

      // Create checklist items from template
      if (templateItems.length > 0) {
        const items = templateItems.map((item) => ({
          checklist_id: checklist.id,
          item_text: item.item_text,
          sort_order: item.sort_order,
          is_done: false,
        }));

        const { error: itemsError } = await supabase
          .from('crew_checklist_items')
          .insert(items);

        if (itemsError) throw itemsError;
      }

      return checklist;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['event-crew-checklists', variables.eventId] });
      toast.success('Checklist created');
    },
    onError: (error: Error) => {
      toast.error('Failed to create checklist', { description: error.message });
    },
  });
}
