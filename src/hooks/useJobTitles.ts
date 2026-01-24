/**
 * JOB TITLES HOOK
 * 
 * Provides access to job title lookup data
 */
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

interface JobTitle {
  id: string;
  name: string;
  sort_order: number;
  is_active: boolean;
}

export function useJobTitles() {
  return useQuery({
    queryKey: ['job-titles'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('job_titles')
        .select('*')
        .eq('is_active', true)
        .order('sort_order', { ascending: true });
      
      if (error) throw error;
      return data as JobTitle[];
    },
  });
}
