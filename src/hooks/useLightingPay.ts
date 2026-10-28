import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';

export const LIGHTING_PRODUCT_ID = 'd085ab8f-4793-41be-a38b-012a3a44baed';
export interface LightingPay {
  id: string;
  quote_item_id: string;
  assignment_id: string;
  unit_rate: number;
}

export function lightingPayTotal(rows: LightingPay[], assignmentId: string) {
  return rows.filter(row => row.assignment_id === assignmentId)
    .reduce((sum, row) => sum + Number(row.unit_rate), 0);
}

export function useLightingPay(eventId: string) {
  return useQuery({
    queryKey: ['lighting-pay', eventId],
    queryFn: async () => {
      const { data, error } = await supabase.from('quote_lighting_pay')
        .select('*, event_assignments!inner(event_id)').eq('event_assignments.event_id', eventId);
      if (error) throw error;
      return data as LightingPay[];
    },
  });
}