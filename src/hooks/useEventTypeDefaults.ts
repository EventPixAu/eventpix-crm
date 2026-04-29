import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { toast } from 'sonner';

interface EventTypeDefault {
  id: string;
  event_type_id: string;
  template_id: string;
  created_at: string;
}

// Fetch defaults for an event type
export function useEventTypeDefaults(eventTypeId: string | undefined) {
  return useQuery({
    queryKey: ['event-type-defaults', eventTypeId],
    queryFn: async () => {
      if (!eventTypeId) return [];
      
      const { data, error } = await supabase
        .from('event_type_workflow_defaults')
        .select('*')
        .eq('event_type_id', eventTypeId);
      
      if (error) throw error;
      return data as EventTypeDefault[];
    },
    enabled: !!eventTypeId,
  });
}

// Fetch all defaults
export function useAllEventTypeDefaults() {
  return useQuery({
    queryKey: ['event-type-defaults-all'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('event_type_workflow_defaults')
        .select('*');
      
      if (error) throw error;
      return data as EventTypeDefault[];
    },
  });
}

// Set defaults for an event type
export function useSetEventTypeDefaults() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async ({ 
      eventTypeId, 
      templateIds 
    }: { 
      eventTypeId: string; 
      templateIds: string[];
    }) => {
      // Delete existing defaults for this event type
      const { error: deleteError } = await supabase
        .from('event_type_workflow_defaults')
        .delete()
        .eq('event_type_id', eventTypeId);
      
      if (deleteError) throw deleteError;
      
      // Insert new defaults
      if (templateIds.length > 0) {
        const defaults = templateIds.map(templateId => ({
          event_type_id: eventTypeId,
          template_id: templateId,
        }));
        
        const { error: insertError } = await supabase
          .from('event_type_workflow_defaults')
          .insert(defaults);
        
        if (insertError) throw insertError;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['event-type-defaults'] });
      queryClient.invalidateQueries({ queryKey: ['event-type-defaults-all'] });
      toast.success('Event type defaults updated');
    },
    onError: (error) => {
      toast.error('Failed to update defaults: ' + error.message);
    },
  });
}
