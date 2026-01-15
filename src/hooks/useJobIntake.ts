import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

export interface JobIntake {
  id: string;
  source: string;
  external_job_id: string | null;
  client_name: string;
  client_email: string | null;
  job_name: string;
  proposed_event_date: string | null;
  status: 'proposed' | 'accepted' | 'cancelled';
  notes: string | null;
  created_at: string;
  updated_at: string;
  converted_at: string | null;
  converted_by: string | null;
}

export function useJobIntakes() {
  return useQuery({
    queryKey: ['job-intakes'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('job_intake')
        .select('*')
        .order('created_at', { ascending: false });
      
      if (error) throw error;
      return data as JobIntake[];
    },
  });
}

export function useJobIntake(id: string | undefined) {
  return useQuery({
    queryKey: ['job-intake', id],
    queryFn: async () => {
      if (!id) return null;
      const { data, error } = await supabase
        .from('job_intake')
        .select('*')
        .eq('id', id)
        .single();
      
      if (error) throw error;
      return data as JobIntake;
    },
    enabled: !!id,
  });
}

export function useCreateJobIntake() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async (intake: Omit<JobIntake, 'id' | 'created_at' | 'updated_at' | 'converted_at' | 'converted_by'>) => {
      const { data, error } = await supabase
        .from('job_intake')
        .insert(intake)
        .select()
        .single();
      
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['job-intakes'] });
      toast.success('Job intake created');
    },
    onError: (error) => {
      toast.error('Failed to create job intake');
      console.error(error);
    },
  });
}

export function useUpdateJobIntake() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async ({ id, ...updates }: Partial<JobIntake> & { id: string }) => {
      const { data, error } = await supabase
        .from('job_intake')
        .update(updates)
        .eq('id', id)
        .select()
        .single();
      
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['job-intakes'] });
      toast.success('Job intake updated');
    },
    onError: (error) => {
      toast.error('Failed to update job intake');
      console.error(error);
    },
  });
}

export function useConvertJobToEvent() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async ({ intakeId, eventData }: { intakeId: string; eventData: any }) => {
      // Create the event with job_intake_id
      const { data: event, error: eventError } = await supabase
        .from('events')
        .insert({
          ...eventData,
          job_intake_id: intakeId,
        })
        .select()
        .single();
      
      if (eventError) throw eventError;
      
      // Update the job intake status
      const { error: intakeError } = await supabase
        .from('job_intake')
        .update({
          status: 'accepted',
          converted_at: new Date().toISOString(),
        })
        .eq('id', intakeId);
      
      if (intakeError) throw intakeError;
      
      return event;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['job-intakes'] });
      queryClient.invalidateQueries({ queryKey: ['events'] });
      toast.success('Job converted to event');
    },
    onError: (error) => {
      toast.error('Failed to convert job to event');
      console.error(error);
    },
  });
}
