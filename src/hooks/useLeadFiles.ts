import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export interface LeadFile {
  id: string;
  lead_id: string;
  file_name: string;
  file_path: string;
  file_size: number | null;
  mime_type: string | null;
  uploaded_by: string | null;
  created_at: string;
}

export function useLeadFiles(leadId: string | undefined) {
  return useQuery({
    queryKey: ['lead-files', leadId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('lead_files')
        .select('*')
        .eq('lead_id', leadId!)
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data as LeadFile[];
    },
    enabled: !!leadId,
  });
}

export function useUploadLeadFile() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ leadId, file }: { leadId: string; file: File }) => {
      const filePath = `${leadId}/${Date.now()}_${file.name}`;
      const { error: uploadError } = await supabase.storage
        .from('lead-files')
        .upload(filePath, file);
      if (uploadError) throw uploadError;

      const { data: userData } = await supabase.auth.getUser();

      const { error: dbError } = await supabase.from('lead_files').insert({
        lead_id: leadId,
        file_name: file.name,
        file_path: filePath,
        file_size: file.size,
        mime_type: file.type,
        uploaded_by: userData.user?.id ?? null,
      });
      if (dbError) throw dbError;
    },
    onSuccess: (_, { leadId }) => {
      queryClient.invalidateQueries({ queryKey: ['lead-files', leadId] });
    },
  });
}

export function useDeleteLeadFile() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ file }: { file: LeadFile }) => {
      const { error: storageError } = await supabase.storage
        .from('lead-files')
        .remove([file.file_path]);
      if (storageError) throw storageError;

      const { error: dbError } = await supabase.from('lead_files').delete().eq('id', file.id);
      if (dbError) throw dbError;
      return file.lead_id;
    },
    onSuccess: (leadId) => {
      queryClient.invalidateQueries({ queryKey: ['lead-files', leadId] });
    },
  });
}
