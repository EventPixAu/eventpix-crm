import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export interface LeadNote {
  id: string;
  lead_id: string;
  content: string;
  created_by: string | null;
  created_at: string;
}

export function useLeadNotes(leadId?: string) {
  return useQuery({
    queryKey: ['lead-notes', leadId],
    enabled: !!leadId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('lead_notes')
        .select('*')
        .eq('lead_id', leadId!)
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data as LeadNote[];
    },
  });
}

export function useAddLeadNote() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ leadId, content }: { leadId: string; content: string }) => {
      const { data, error } = await supabase
        .from('lead_notes')
        .insert({ lead_id: leadId, content })
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: (_, { leadId }) => {
      qc.invalidateQueries({ queryKey: ['lead-notes', leadId] });
    },
  });
}

export function useDeleteLeadNote() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, leadId }: { id: string; leadId: string }) => {
      const { error } = await supabase.from('lead_notes').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: (_, { leadId }) => {
      qc.invalidateQueries({ queryKey: ['lead-notes', leadId] });
    },
  });
}
