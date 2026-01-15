import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export interface EventType {
  id: string;
  name: string;
}

export interface DeliveryMethod {
  id: string;
  name: string;
}

export function useEventTypes() {
  return useQuery({
    queryKey: ['event-types'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('event_types')
        .select('*')
        .order('name');
      
      if (error) throw error;
      return data as EventType[];
    },
  });
}

export function useDeliveryMethods() {
  return useQuery({
    queryKey: ['delivery-methods'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('delivery_methods_lookup')
        .select('*')
        .order('name');
      
      if (error) throw error;
      return data as DeliveryMethod[];
    },
  });
}
