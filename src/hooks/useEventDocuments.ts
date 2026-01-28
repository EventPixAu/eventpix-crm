/**
 * Hook for managing event documents (PDFs, run sheets, etc.)
 */
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

export interface EventDocument {
  id: string;
  event_id: string;
  file_name: string;
  file_path: string;
  file_size: number | null;
  mime_type: string | null;
  description: string | null;
  is_visible_to_crew: boolean;
  uploaded_by: string | null;
  created_at: string;
  updated_at: string;
}

export function useEventDocuments(eventId: string | undefined) {
  return useQuery({
    queryKey: ['event-documents', eventId],
    queryFn: async () => {
      if (!eventId) return [];
      
      const { data, error } = await supabase
        .from('event_documents')
        .select('*')
        .eq('event_id', eventId)
        .order('created_at', { ascending: false });
      
      if (error) throw error;
      return data as EventDocument[];
    },
    enabled: !!eventId,
  });
}

export function useUploadEventDocument() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async ({
      eventId,
      file,
      description,
      isVisibleToCrew = true,
    }: {
      eventId: string;
      file: File;
      description?: string;
      isVisibleToCrew?: boolean;
    }) => {
      // Generate unique file path: event-documents/{event_id}/{timestamp}_{filename}
      const timestamp = Date.now();
      const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_');
      const filePath = `${eventId}/${timestamp}_${safeName}`;
      
      // Upload file to storage
      const { error: uploadError } = await supabase.storage
        .from('event-documents')
        .upload(filePath, file);
      
      if (uploadError) throw uploadError;
      
      // Get current user
      const { data: { user } } = await supabase.auth.getUser();
      
      // Create metadata record
      const { data, error } = await supabase
        .from('event_documents')
        .insert([{
          event_id: eventId,
          file_name: file.name,
          file_path: filePath,
          file_size: file.size,
          mime_type: file.type,
          description: description || null,
          is_visible_to_crew: isVisibleToCrew,
          uploaded_by: user?.id || null,
        }])
        .select()
        .single();
      
      if (error) {
        // Clean up uploaded file if metadata insert fails
        await supabase.storage.from('event-documents').remove([filePath]);
        throw error;
      }
      
      return data;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['event-documents', variables.eventId] });
      toast.success('Document uploaded');
    },
    onError: (error: any) => {
      console.error('Upload error:', error);
      toast.error('Failed to upload document');
    },
  });
}

export function useUpdateEventDocument() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async ({
      id,
      eventId,
      description,
      isVisibleToCrew,
    }: {
      id: string;
      eventId: string;
      description?: string;
      isVisibleToCrew?: boolean;
    }) => {
      const updates: Record<string, any> = {};
      if (description !== undefined) updates.description = description;
      if (isVisibleToCrew !== undefined) updates.is_visible_to_crew = isVisibleToCrew;
      
      const { data, error } = await supabase
        .from('event_documents')
        .update(updates)
        .eq('id', id)
        .select()
        .single();
      
      if (error) throw error;
      return data;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['event-documents', variables.eventId] });
      toast.success('Document updated');
    },
    onError: () => {
      toast.error('Failed to update document');
    },
  });
}

export function useDeleteEventDocument() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async ({ id, eventId, filePath }: { id: string; eventId: string; filePath: string }) => {
      // Delete from storage
      const { error: storageError } = await supabase.storage
        .from('event-documents')
        .remove([filePath]);
      
      if (storageError) {
        console.warn('Storage delete failed:', storageError);
        // Continue to delete metadata anyway
      }
      
      // Delete metadata
      const { error } = await supabase
        .from('event_documents')
        .delete()
        .eq('id', id);
      
      if (error) throw error;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['event-documents', variables.eventId] });
      toast.success('Document deleted');
    },
    onError: () => {
      toast.error('Failed to delete document');
    },
  });
}

export function useGetDocumentUrl() {
  return async (filePath: string) => {
    const { data, error } = await supabase.storage
      .from('event-documents')
      .createSignedUrl(filePath, 3600); // 1 hour expiry
    
    if (error) throw error;
    return data.signedUrl;
  };
}
