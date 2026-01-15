import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

export interface GalleryAsset {
  id: string;
  event_id: string;
  storage_path: string;
  file_name: string;
  mime_type: string | null;
  file_size: number | null;
  sort_order: number;
  created_at: string;
}

const BUCKET_NAME = 'eventpix-galleries';

export function useGalleryAssets(eventId: string | undefined) {
  return useQuery({
    queryKey: ['gallery-assets', eventId],
    queryFn: async () => {
      if (!eventId) return [];
      const { data, error } = await supabase
        .from('gallery_assets')
        .select('*')
        .eq('event_id', eventId)
        .order('sort_order', { ascending: true });
      if (error) throw error;
      return data as GalleryAsset[];
    },
    enabled: !!eventId,
  });
}

export function useGalleryAssetsByEventId(eventId: string | undefined) {
  return useQuery({
    queryKey: ['gallery-assets-public', eventId],
    queryFn: async () => {
      if (!eventId) return [];
      const { data, error } = await supabase
        .from('gallery_assets')
        .select('*')
        .eq('event_id', eventId)
        .order('sort_order', { ascending: true });
      if (error) throw error;
      return data as GalleryAsset[];
    },
    enabled: !!eventId,
  });
}

export function useUploadGalleryAsset() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async ({ eventId, file }: { eventId: string; file: File }) => {
      // Get the current max sort_order for this event
      const { data: existingAssets } = await supabase
        .from('gallery_assets')
        .select('sort_order')
        .eq('event_id', eventId)
        .order('sort_order', { ascending: false })
        .limit(1);
      
      const nextSortOrder = (existingAssets?.[0]?.sort_order ?? 0) + 1;

      const fileExt = file.name.split('.').pop();
      const fileName = `${crypto.randomUUID()}.${fileExt}`;
      const storagePath = `${eventId}/${fileName}`;

      // Upload to storage
      const { error: uploadError } = await supabase.storage
        .from(BUCKET_NAME)
        .upload(storagePath, file, {
          cacheControl: '3600',
          upsert: false,
        });

      if (uploadError) throw uploadError;

      // Create asset record
      const { data, error: insertError } = await supabase
        .from('gallery_assets')
        .insert({
          event_id: eventId,
          storage_path: storagePath,
          file_name: file.name,
          mime_type: file.type,
          file_size: file.size,
          sort_order: nextSortOrder,
        })
        .select()
        .single();

      if (insertError) {
        // Clean up uploaded file if record creation fails
        await supabase.storage.from(BUCKET_NAME).remove([storagePath]);
        throw insertError;
      }

      return data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['gallery-assets', data.event_id] });
      toast({ title: 'Image uploaded successfully' });
    },
    onError: (error: Error) => {
      toast({ title: 'Failed to upload image', description: error.message, variant: 'destructive' });
    },
  });
}

export function useDeleteGalleryAsset() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async ({ id, eventId, storagePath }: { id: string; eventId: string; storagePath: string }) => {
      // Delete from storage
      const { error: storageError } = await supabase.storage
        .from(BUCKET_NAME)
        .remove([storagePath]);

      if (storageError) throw storageError;

      // Delete record
      const { error: deleteError } = await supabase
        .from('gallery_assets')
        .delete()
        .eq('id', id);

      if (deleteError) throw deleteError;

      return { eventId };
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['gallery-assets', data.eventId] });
      toast({ title: 'Image deleted' });
    },
    onError: (error: Error) => {
      toast({ title: 'Failed to delete image', description: error.message, variant: 'destructive' });
    },
  });
}

export function useReorderGalleryAssets() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async ({ eventId, orderedIds }: { eventId: string; orderedIds: string[] }) => {
      // Update sort_order for each asset
      const updates = orderedIds.map((id, index) => 
        supabase
          .from('gallery_assets')
          .update({ sort_order: index + 1 })
          .eq('id', id)
      );

      const results = await Promise.all(updates);
      const errors = results.filter(r => r.error);
      
      if (errors.length > 0) {
        throw new Error('Failed to update some images');
      }

      return { eventId };
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['gallery-assets', data.eventId] });
    },
    onError: (error: Error) => {
      toast({ title: 'Failed to reorder images', description: error.message, variant: 'destructive' });
    },
  });
}

export function getPublicUrl(storagePath: string): string {
  const { data } = supabase.storage.from(BUCKET_NAME).getPublicUrl(storagePath);
  return data.publicUrl;
}
