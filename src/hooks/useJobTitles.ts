/**
 * JOB TITLES HOOK
 * 
 * Provides access to job title lookup data
 */
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

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

export function useCreateJobTitle() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (name: string) => {
      const { data: maxData } = await supabase
        .from('job_titles')
        .select('sort_order')
        .order('sort_order', { ascending: false })
        .limit(1)
        .single();

      const nextOrder = (maxData?.sort_order || 0) + 1;

      const { data, error } = await supabase
        .from('job_titles')
        .insert({ name, sort_order: nextOrder })
        .select()
        .single();

      if (error) throw error;
      return data as JobTitle;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['job-titles'] });
      toast.success('Job title created');
    },
    onError: (error: Error) => {
      toast.error('Failed to create job title: ' + error.message);
    },
  });
}
