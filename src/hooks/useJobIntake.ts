/**
 * DEPRECATED: Job Intake Hook
 * 
 * This hook is deprecated. The unified platform now uses:
 * - useSales hooks for Clients, Leads, Quotes
 * - useConvertQuoteToEvent for Sales → Ops conversion
 * 
 * Kept for backward compatibility with legacy intake records.
 * 
 * Handoff Status Flow (legacy):
 * - draft: Initial entry, not ready for operations
 * - ready_for_ops: Sales has confirmed, ready to convert to event
 * - converted: Event created, intake becomes read-only
 * - cancelled: Job rejected or cancelled
 */
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

export type HandoffStatus = 'draft' | 'ready_for_ops' | 'converted' | 'cancelled';

export interface JobIntake {
  id: string;
  source: string;
  external_job_id: string | null;
  client_name: string;
  client_email: string | null;
  job_name: string;
  proposed_event_date: string | null;
  status: 'proposed' | 'accepted' | 'cancelled'; // Legacy field
  handoff_status: HandoffStatus; // New authoritative field
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

/**
 * SALES → OPERATIONS HANDOFF
 * 
 * This mutation formally transfers ownership from Sales to Operations.
 * After conversion:
 * - Job intake becomes read-only (enforced by DB trigger)
 * - Event is created with ops ownership
 * - Sales CRM retains client relationship
 */
export function useConvertJobToEvent() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async ({ intakeId, eventData }: { intakeId: string; eventData: any }) => {
      // Create the event with job_intake_id (establishes ops ownership)
      const { data: event, error: eventError } = await supabase
        .from('events')
        .insert({
          ...eventData,
          job_intake_id: intakeId,
        })
        .select()
        .single();
      
      if (eventError) throw eventError;
      
      // Mark handoff complete - this triggers immutability
      const { error: intakeError } = await supabase
        .from('job_intake')
        .update({
          status: 'accepted', // Legacy field for backward compatibility
          handoff_status: 'converted', // Authoritative handoff status
          converted_at: new Date().toISOString(),
        })
        .eq('id', intakeId);
      
      if (intakeError) throw intakeError;
      
      return event;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['job-intakes'] });
      queryClient.invalidateQueries({ queryKey: ['events'] });
      toast.success('Sales handoff complete - Event created');
    },
    onError: (error) => {
      toast.error('Failed to convert job to event');
      console.error(error);
    },
  });
}

/**
 * Mark a job as ready for operations (Sales has confirmed)
 */
export function useMarkReadyForOps() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async (id: string) => {
      const { data, error } = await supabase
        .from('job_intake')
        .update({ handoff_status: 'ready_for_ops' })
        .eq('id', id)
        .select()
        .single();
      
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['job-intakes'] });
      toast.success('Job marked ready for operations');
    },
    onError: (error) => {
      toast.error('Failed to update job status');
      console.error(error);
    },
  });
}
