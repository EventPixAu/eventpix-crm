/**
 * LOST REASONS HOOK
 * 
 * Provides data access for the lost_reasons lookup table.
 * Used for lead lost reason dropdown options.
 */
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export interface LostReason {
  id: string;
  name: string;
  description: string | null;
  is_active: boolean;
  sort_order: number;
  created_at: string;
}

// Returns ACTIVE lost reasons only
export function useLostReasons() {
  return useQuery({
    queryKey: ['lost-reasons', 'active'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('lost_reasons')
        .select('*')
        .eq('is_active', true)
        .order('sort_order')
        .order('name');
      
      if (error) throw error;
      return data as LostReason[];
    },
  });
}
