import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
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
      // First get profiles
      const { data: profiles, error: profilesError } = await supabase
        .from('profiles')
        .select('id, email, full_name, phone, status, is_active, created_at, updated_at')
        .order('created_at', { ascending: false });

      if (profilesError) throw profilesError;

      // Then get roles for each profile
      const { data: roles, error: rolesError } = await supabase
        .from('user_roles')
        .select('user_id, role');

      if (rolesError) throw rolesError;

      // Merge roles into profiles
      const roleMap = new Map(roles?.map(r => [r.user_id, r.role]) || []);
      
      return (profiles || []).map(p => ({
        id: p.id,
        email: p.email,
        full_name: p.full_name,
        phone: p.phone,
        is_active: p.is_active ?? p.status === 'active',
        created_at: p.created_at,
        updated_at: p.updated_at,
        role: roleMap.get(p.id) || null
      })) as UserProfile[];
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
  const { toast } = useToast();

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
      toast({
        title: 'Failed to create invitation',
        description: error.message,
        variant: 'destructive',
      });
    },
  });
}

// Create user via edge function (step 2: call edge function to create auth user)
export function useCreateUser() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

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
      toast({
        title: 'User invited',
        description: 'An invitation email has been sent to the user.',
      });
    },
    onError: (error: Error) => {
      toast({
        title: 'Failed to invite user',
        description: error.message,
        variant: 'destructive',
      });
    },
  });
}

// Combined hook for invite flow (provision + create)
export function useInviteUser() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
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
      toast({
        title: 'User invited',
        description: 'An invitation email has been sent to the user.',
      });
    },
    onError: (error: Error) => {
      toast({
        title: 'Failed to invite user',
        description: error.message,
        variant: 'destructive',
      });
    },
  });
}

// Resend invitation (reprovision + create)
export function useResendInvitation() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

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
      toast({
        title: 'Invitation resent',
        description: 'A new invitation email has been sent.',
      });
    },
    onError: (error: Error) => {
      toast({
        title: 'Failed to resend invitation',
        description: error.message,
        variant: 'destructive',
      });
    },
  });
}

// Revoke invitation
export function useRevokeInvitation() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

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
      toast({
        title: 'Invitation revoked',
        description: 'The invitation has been cancelled.',
      });
    },
    onError: (error: Error) => {
      toast({
        title: 'Failed to revoke invitation',
        description: error.message,
        variant: 'destructive',
      });
    },
  });
}

// Set user active/inactive
export function useSetUserActive() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

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
      toast({
        title: variables.isActive ? 'User activated' : 'User deactivated',
        description: `The user has been ${variables.isActive ? 'activated' : 'deactivated'}.`,
      });
    },
    onError: (error: Error) => {
      toast({
        title: 'Failed to update user status',
        description: error.message,
        variant: 'destructive',
      });
    },
  });
}

// Set user role
export function useSetUserRole() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

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
      toast({
        title: 'Role updated',
        description: 'The user role has been changed.',
      });
    },
    onError: (error: Error) => {
      toast({
        title: 'Failed to update role',
        description: error.message,
        variant: 'destructive',
      });
    },
  });
}
