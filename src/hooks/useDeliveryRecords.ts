import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { toast } from 'sonner';
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
      const { data, error } = await (supabase as any)
        .rpc('get_delivery_by_qr_token', { p_token: qrToken });
      if (error) throw error;
      const row = Array.isArray(data) ? data[0] : data;
      return row ?? null;
    },
    enabled: !!qrToken,
  });
}

export function useCreateDeliveryRecord() {
  const queryClient = useQueryClient();

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
      toast.success('Delivery record created');
    },
    onError: (error: Error) => {
      toast.error('Failed to create delivery record', { description: error.message });
    },
  });
}

export function useUpdateDeliveryRecord() {
  const queryClient = useQueryClient();

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
      toast.success('Delivery record updated');
    },
    onError: (error: Error) => {
      toast.error('Failed to update delivery record', { description: error.message });
    },
  });
}
