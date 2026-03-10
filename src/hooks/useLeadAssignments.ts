import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

export interface LeadAssignment {
  id: string;
  lead_id: string;
  user_id: string | null;
  staff_role_id: string | null;
  role_on_event: string | null;
  assignment_notes: string | null;
  confirmation_status: string;
  confirmed_at: string | null;
  created_at: string | null;
  created_by: string | null;
  profile?: {
    id: string;
    full_name: string | null;
    email: string;
    avatar_url: string | null;
  } | null;
  staff_role?: {
    id: string;
    name: string;
  } | null;
}

export function useLeadAssignments(leadId: string | undefined) {
  return useQuery({
    queryKey: ['lead-assignments', leadId],
    queryFn: async () => {
      if (!leadId) return [];
      const { data, error } = await supabase
        .from('lead_assignments')
        .select(`
          *,
          profile:profiles!lead_assignments_user_id_fkey (
            id,
            full_name,
            email,
            avatar_url
          ),
          staff_role:staff_roles!lead_assignments_staff_role_id_fkey (
            id,
            name
          )
        `)
        .eq('lead_id', leadId)
        .order('created_at', { ascending: true });

      if (error) throw error;
      return (data || []) as unknown as LeadAssignment[];
    },
    enabled: !!leadId,
  });
}

export function useCreateLeadAssignment() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (params: {
      lead_id: string;
      user_id: string;
      staff_role_id?: string;
      assignment_notes?: string;
    }) => {
      const { data, error } = await supabase
        .from('lead_assignments')
        .insert({
          lead_id: params.lead_id,
          user_id: params.user_id,
          staff_role_id: params.staff_role_id || null,
          assignment_notes: params.assignment_notes || null,
          confirmation_status: 'pending',
        })
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['lead-assignments', variables.lead_id] });
      toast.success('Staff assigned to lead');
    },
    onError: (error: Error) => {
      toast.error('Failed to assign staff: ' + error.message);
    },
  });
}

export function useDeleteLeadAssignment() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, leadId }: { id: string; leadId: string }) => {
      const { error } = await supabase
        .from('lead_assignments')
        .delete()
        .eq('id', id);

      if (error) throw error;
      return leadId;
    },
    onSuccess: (leadId) => {
      queryClient.invalidateQueries({ queryKey: ['lead-assignments', leadId] });
      toast.success('Assignment removed');
    },
    onError: (error: Error) => {
      toast.error('Failed to remove assignment: ' + error.message);
    },
  });
}
