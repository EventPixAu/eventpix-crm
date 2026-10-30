import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
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
  notification_sent_at?: string | null;
  notification_error?: string | null;
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
          confirmation_status: 'on_hold',
        } as any)
        .select()
        .maybeSingle();

      if (error) throw error;
      if (!data) throw new Error('Assignment was not saved');
      const { data: invitation, error: inviteError } = await supabase.functions.invoke('send-notification', {
        body: { type: 'lead_assignment', lead_id: params.lead_id, assignment_id: data.id },
      });
      return { assignment: data, inviteError: inviteError?.message || invitation?.error, warning: invitation?.warning };
    },
    onSuccess: (result, variables) => {
      queryClient.invalidateQueries({ queryKey: ['lead-assignments', variables.lead_id] });
      queryClient.invalidateQueries({ queryKey: ['staff-calendar-events'] });
      queryClient.invalidateQueries({ queryKey: ['email-logs'] });
      if (result.inviteError) toast.error('Team member assigned, but the invitation was not confirmed sent. Use Resend invitation to try again.');
      else if (result.warning) toast.warning(result.warning);
      else toast.success('Team member assigned and On Hold invitation sent');
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
      queryClient.invalidateQueries({ queryKey: ['staff-calendar-events'] });
      toast.success('Assignment removed');
    },
    onError: (error: Error) => {
      toast.error('Failed to remove assignment: ' + error.message);
    },
  });
}

export function useResendLeadInvitation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, leadId }: { id: string; leadId: string }) => {
      const { data, error } = await supabase.functions.invoke('send-notification', {
        body: { type: 'lead_assignment', lead_id: leadId, assignment_id: id },
      });
      if (error || data?.error) throw new Error(error?.message || data.error);
      return data;
    },
    onSuccess: (data, variables) => {
      queryClient.invalidateQueries({ queryKey: ['lead-assignments', variables.leadId] });
      queryClient.invalidateQueries({ queryKey: ['email-logs'] });
      if (data?.warning) toast.warning(data.warning);
      else toast.success('On Hold invitation sent');
    },
    onError: (error: Error) => toast.error('Invitation could not be confirmed sent: ' + error.message),
  });
}
