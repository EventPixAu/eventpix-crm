import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import type { Tables, TablesInsert, TablesUpdate } from '@/integrations/supabase/types';

export type DeliveryRecord = Tables<'delivery_records'>;

export function useDeliveryRecord(eventId: string | undefined) {
  return useQuery({
    queryKey: ['delivery-record', eventId],
    queryFn: async () => {
      if (!eventId) return null;
      const { data, error } = await supabase
        .from('delivery_records')
        .select('*')
        .eq('event_id', eventId)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
    enabled: !!eventId,
  });
}

export function useDeliveryRecordByToken(qrToken: string | undefined) {
  return useQuery({
    queryKey: ['delivery-record-token', qrToken],
    queryFn: async () => {
      if (!qrToken) return null;
      const { data, error } = await supabase
        .from('delivery_records')
        .select(`
          id,
          delivery_link,
          delivery_method,
          delivery_method_id,
          qr_enabled,
          event_id
        `)
        .eq('qr_token', qrToken)
        .eq('qr_enabled', true)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
    enabled: !!qrToken,
  });
}

export function useCreateDeliveryRecord() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (record: TablesInsert<'delivery_records'>) => {
      const { data, error } = await supabase
        .from('delivery_records')
        .insert(record)
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['delivery-record', data.event_id] });
      queryClient.invalidateQueries({ queryKey: ['delivery-records'] });
      toast({ title: 'Delivery record created' });
    },
    onError: (error: Error) => {
      toast({ title: 'Failed to create delivery record', description: error.message, variant: 'destructive' });
    },
  });
}

export function useUpdateDeliveryRecord() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async ({ id, ...updates }: TablesUpdate<'delivery_records'> & { id: string }) => {
      const { data, error } = await supabase
        .from('delivery_records')
        .update(updates)
        .eq('id', id)
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['delivery-record', data.event_id] });
      queryClient.invalidateQueries({ queryKey: ['delivery-records'] });
      toast({ title: 'Delivery record updated' });
    },
    onError: (error: Error) => {
      toast({ title: 'Failed to update delivery record', description: error.message, variant: 'destructive' });
    },
  });
}
