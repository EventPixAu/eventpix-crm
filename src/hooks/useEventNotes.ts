import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

export interface EventNote {
  id: string;
  event_id: string;
  created_by: string;
  content: string;
  note_type: string | null;
  created_at: string;
  profile?: {
    id: string;
    full_name: string | null;
    email: string;
  } | null;
}

export function useEventNotes(eventId: string | undefined) {
  return useQuery({
    queryKey: ['event-notes', eventId],
    queryFn: async () => {
      if (!eventId) return [];
      
      const { data, error } = await supabase
        .from('event_notes')
        .select(`
          *,
          profile:profiles!event_notes_created_by_fkey (
            id,
            full_name,
            email
          )
        `)
        .eq('event_id', eventId)
        .order('created_at', { ascending: false });
      
      if (error) throw error;
      return data as EventNote[];
    },
    enabled: !!eventId,
  });
}

export function useCreateEventNote() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async ({ 
      eventId, 
      content, 
      createdBy,
      noteType = 'observation' 
    }: { 
      eventId: string; 
      content: string; 
      createdBy: string;
      noteType?: string;
    }) => {
      const { data, error } = await supabase
        .from('event_notes')
        .insert({
          event_id: eventId,
          content,
          created_by: createdBy,
          note_type: noteType,
        })
        .select()
        .single();
      
      if (error) throw error;
      return data;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['event-notes', variables.eventId] });
      toast({ title: 'Note added' });
    },
    onError: (error: Error) => {
      toast({ 
        title: 'Failed to add note', 
        description: error.message, 
        variant: 'destructive' 
      });
    },
  });
}

export function useDeleteEventNote() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async ({ noteId, eventId }: { noteId: string; eventId: string }) => {
      const { error } = await supabase
        .from('event_notes')
        .delete()
        .eq('id', noteId);
      
      if (error) throw error;
      return eventId;
    },
    onSuccess: (eventId) => {
      queryClient.invalidateQueries({ queryKey: ['event-notes', eventId] });
      toast({ title: 'Note deleted' });
    },
    onError: (error: Error) => {
      toast({ 
        title: 'Failed to delete note', 
        description: error.message, 
        variant: 'destructive' 
      });
    },
  });
}
