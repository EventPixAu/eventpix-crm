import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { toast } from 'sonner';
import { Json } from '@/integrations/supabase/types';

// Types
export interface UserProfile {
  id: string;
  email: string | null;
  full_name: string | null;
  phone: string | null;
  is_active: boolean | null;
  created_at: string | null;
  updated_at: string | null;
  role?: string | null;
  registration_status: 'pending' | 'active' | 'inactive';
}

export interface UserInvitation {
  id: string;
  email: string;
  role: string;
  status: string;
  invited_by: string;
  auth_user_id: string | null;
  error: string | null;
  created_at: string;
  updated_at: string;
  inviter?: { full_name: string | null; email: string | null };
}

interface RpcResponse {
  success: boolean;
  error?: string;
  invitation_id?: string;
  user_id?: string;
  role?: string;
}

function parseRpcResponse(data: Json | null): RpcResponse {
  if (data && typeof data === 'object' && !Array.isArray(data)) {
    return data as unknown as RpcResponse;
  }
  return { success: false, error: 'Invalid response' };
}

// Fetch all users with their roles
export function useUsers() {
  return useQuery({
    queryKey: ['admin-users'],
    queryFn: async () => {
      // Fetch profiles, roles, and invitations in parallel
      const [profilesRes, rolesRes, invitationsRes] = await Promise.all([
        supabase
          .from('profiles')
          .select('id, email, full_name, phone, status, is_active, created_at, updated_at, onboarding_status')
          .order('created_at', { ascending: false }),
        supabase
          .from('user_roles')
          .select('user_id, role'),
        supabase
          .from('user_invitations')
          .select('auth_user_id, status')
          .not('auth_user_id', 'is', null),
      ]);

      if (profilesRes.error) throw profilesRes.error;
      if (rolesRes.error) throw rolesRes.error;

      const roleMap = new Map(rolesRes.data?.map(r => [r.user_id, r.role]) || []);
      
      // Build a map of user_id -> invitation status
      const invitationStatusMap = new Map<string, string>();
      (invitationsRes.data || []).forEach(inv => {
        if (inv.auth_user_id) {
          invitationStatusMap.set(inv.auth_user_id, inv.status);
        }
      });
      
      return (profilesRes.data || []).map(p => {
        const invStatus = invitationStatusMap.get(p.id);
        // User is "pending" if they have an invitation that hasn't been accepted
        // AND they have no full_name set (haven't completed registration)
        const hasNotRegistered = !p.full_name || p.full_name.trim() === '';
        const invitationPending = invStatus && invStatus !== 'accepted';
        const isInactive = p.is_active === false || p.status === 'inactive';
        
        let registration_status: 'pending' | 'active' | 'inactive' = 'active';
        if (isInactive) {
          registration_status = 'inactive';
        } else if (hasNotRegistered && invitationPending) {
          registration_status = 'pending';
        }

        return {
          id: p.id,
          email: p.email,
          full_name: p.full_name,
          phone: p.phone,
          is_active: p.is_active ?? p.status === 'active',
          created_at: p.created_at,
          updated_at: p.updated_at,
          role: roleMap.get(p.id) || null,
          registration_status,
        };
      }) as UserProfile[];
    },
  });
}

// Fetch all invitations
export function useInvitations() {
  return useQuery({
    queryKey: ['admin-invitations'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('user_invitations')
        .select(`
          id, email, role, status, invited_by, auth_user_id, error, created_at, updated_at,
          inviter:profiles!user_invitations_invited_by_fkey(full_name, email)
        `)
        .order('created_at', { ascending: false });

      if (error) throw error;
      return data as unknown as UserInvitation[];
    },
  });
}

// Provision invitation (step 1: create invitation record)
export function useProvisionInvitation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ email, role }: { email: string; role: string }) => {
      const { data, error } = await supabase.rpc('provision_user_invitation', {
        p_email: email,
        p_role: role,
      });

      if (error) throw error;
      
      const result = parseRpcResponse(data);
      if (!result.success) {
        throw new Error(result.error || 'Failed to provision invitation');
      }
      
      return result;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-invitations'] });
    },
    onError: (error: Error) => {
      toast.error('Failed to create invitation', { description: error.message });
    },
  });
}

// Create user via edge function (step 2: call edge function to create auth user)
export function useCreateUser() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (invitationId: string) => {
      const { data, error } = await supabase.functions.invoke('admin-create-user', {
        body: { invitation_id: invitationId },
      });

      if (error) throw error;
      
      if (!data?.success) {
        throw new Error(data?.error || 'Failed to create user');
      }
      
      return data as RpcResponse;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-invitations'] });
      queryClient.invalidateQueries({ queryKey: ['admin-users'] });
      toast.success('User invited', { description: 'An invitation email has been sent to the user.' });
    },
    onError: (error: Error) => {
      toast.error('Failed to invite user', { description: error.message });
    },
  });
}

// Combined hook for invite flow (provision + create)
export function useInviteUser() {
  const queryClient = useQueryClient();
  const provisionMutation = useProvisionInvitation();
  const createMutation = useCreateUser();

  return useMutation({
    mutationFn: async ({ email, role }: { email: string; role: string }) => {
      // Step 1: Provision invitation
      const provisionResult = await provisionMutation.mutateAsync({ email, role });
      
      if (!provisionResult.invitation_id) {
        throw new Error('Failed to get invitation ID');
      }

      // Step 2: Create user via edge function
      const createResult = await createMutation.mutateAsync(provisionResult.invitation_id);
      
      return createResult;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-invitations'] });
      queryClient.invalidateQueries({ queryKey: ['admin-users'] });
      toast.success('User invited', { description: 'An invitation email has been sent to the user.' });
    },
    onError: (error: Error) => {
      toast.error('Failed to invite user', { description: error.message });
    },
  });
}

// Resend invitation (reprovision + create)
export function useResendInvitation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (invitationId: string) => {
      const { data, error } = await supabase.functions.invoke('admin-create-user', {
        body: { invitation_id: invitationId },
      });

      if (error) throw error;
      
      if (!data?.success) {
        throw new Error(data?.error || 'Failed to resend invitation');
      }
      
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-invitations'] });
      toast.success('Invitation resent', { description: 'A new invitation email has been sent.' });
    },
    onError: (error: Error) => {
      toast.error('Failed to resend invitation', { description: error.message });
    },
  });
}

// Revoke invitation
export function useRevokeInvitation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (invitationId: string) => {
      const { data, error } = await supabase.rpc('revoke_invitation', {
        p_invitation_id: invitationId,
      });

      if (error) throw error;
      
      const result = parseRpcResponse(data);
      if (!result.success) {
        throw new Error(result.error || 'Failed to revoke invitation');
      }
      
      return result;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-invitations'] });
      toast.success('Invitation revoked', { description: 'The invitation has been cancelled.' });
    },
    onError: (error: Error) => {
      toast.error('Failed to revoke invitation', { description: error.message });
    },
  });
}

// Set user active/inactive
export function useSetUserActive() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ userId, isActive }: { userId: string; isActive: boolean }) => {
      const { data, error } = await supabase.rpc('set_user_active', {
        p_user_id: userId,
        p_is_active: isActive,
      });

      if (error) throw error;
      
      const result = parseRpcResponse(data);
      if (!result.success) {
        throw new Error(result.error || 'Failed to update user status');
      }
      
      return result;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['admin-users'] });
      toast.success(variables.isActive ? 'User activated' : 'User deactivated', { description: `The user has been ${variables.isActive ? 'activated' : 'deactivated'}.` });
    },
    onError: (error: Error) => {
      toast.error('Failed to update user status', { description: error.message });
    },
  });
}

// Set user role
export function useSetUserRole() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ userId, role }: { userId: string; role: string }) => {
      const { data, error } = await supabase.rpc('set_user_role', {
        p_user_id: userId,
        p_role: role,
      });

      if (error) throw error;
      
      const result = parseRpcResponse(data);
      if (!result.success) {
        throw new Error(result.error || 'Failed to update user role');
      }
      
      return result;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-users'] });
      toast.success('Role updated', { description: 'The user role has been changed.' });
    },
    onError: (error: Error) => {
      toast.error('Failed to update role', { description: error.message });
    },
  });
}
