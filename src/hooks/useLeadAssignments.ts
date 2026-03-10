import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

export interface LeadAssignment {
  id: string;
  lead_id: string;
  user_id: string | null;
  staff_role_id: string | null;
  session_id: string | null;
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
          staff_role:staff_roles!lead_assignments_staff_role_id_fkey (
            id,
            name
          )
        `)
        .eq('lead_id', leadId)
        .order('created_at', { ascending: true });

      if (error) throw error;

      // Fetch profiles separately since FK points to auth.users not profiles
      const userIds = (data || []).map((a: any) => a.user_id).filter(Boolean);
      let profileMap: Record<string, any> = {};
      if (userIds.length > 0) {
        const { data: profiles } = await supabase
          .from('profiles')
          .select('id, full_name, email, avatar_url')
          .in('id', userIds);
        if (profiles) {
          profiles.forEach((p) => { profileMap[p.id] = p; });
        }
      }

      return (data || []).map((a: any) => ({
        ...a,
        profile: a.user_id ? profileMap[a.user_id] || null : null,
      })) as LeadAssignment[];
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
      session_id?: string;
      assignment_notes?: string;
    }) => {
      const { data, error } = await supabase
        .from('lead_assignments')
        .insert({
          lead_id: params.lead_id,
          user_id: params.user_id,
          staff_role_id: params.staff_role_id || null,
          session_id: params.session_id || null,
          assignment_notes: params.assignment_notes || null,
          confirmation_status: 'pending',
        } as any)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['lead-assignments', variables.lead_id] });
      toast.success('Staff assigned');
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
