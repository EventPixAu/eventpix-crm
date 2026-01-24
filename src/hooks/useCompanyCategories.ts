/**
 * COMPANY CATEGORIES HOOK
 * 
 * Provides access to company category lookup data
 */
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

interface CompanyCategory {
  id: string;
  name: string;
  sort_order: number;
  is_active: boolean;
}

export function useCompanyCategories() {
  return useQuery({
    queryKey: ['company-categories'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('company_categories')
        .select('*')
        .eq('is_active', true)
        .order('sort_order', { ascending: true });
      
      if (error) throw error;
      return data as CompanyCategory[];
    },
  });
}
