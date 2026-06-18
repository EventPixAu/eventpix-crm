import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';

export interface QuoteFile {
  id: string;
  quote_id: string;
  file_name: string;
  file_path: string;
  file_size: number | null;
  mime_type: string | null;
  uploaded_by: string | null;
  created_at: string;
}

export function useQuoteFiles(quoteId: string | undefined) {
  return useQuery({
    queryKey: ['quote-files', quoteId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('quote_files' as any)
        .select('*')
        .eq('quote_id', quoteId!)
        .order('created_at', { ascending: false });
      if (error) throw error;
      return (data || []) as unknown as QuoteFile[];
    },
    enabled: !!quoteId,
  });
}

export function useUploadQuoteFile() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ quoteId, file }: { quoteId: string; file: File }) => {
      const filePath = `${quoteId}/${Date.now()}_${file.name}`;
      const { error: uploadError } = await supabase.storage
        .from('quote-files')
        .upload(filePath, file);
      if (uploadError) throw uploadError;

      const { data: userData } = await supabase.auth.getUser();

      const { error: dbError } = await supabase.from('quote_files' as any).insert({
        quote_id: quoteId,
        file_name: file.name,
        file_path: filePath,
        file_size: file.size,
        mime_type: file.type,
        uploaded_by: userData.user?.id ?? null,
      });
      if (dbError) throw dbError;
    },
    onSuccess: (_, { quoteId }) => {
      queryClient.invalidateQueries({ queryKey: ['quote-files', quoteId] });
    },
  });
}

export function useDeleteQuoteFile() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ file }: { file: QuoteFile }) => {
      const { error: storageError } = await supabase.storage
        .from('quote-files')
        .remove([file.file_path]);
      if (storageError) throw storageError;

      const { error: dbError } = await supabase
        .from('quote_files' as any)
        .delete()
        .eq('id', file.id);
      if (dbError) throw dbError;
      return file.quote_id;
    },
    onSuccess: (quoteId) => {
      queryClient.invalidateQueries({ queryKey: ['quote-files', quoteId] });
    },
  });
}
