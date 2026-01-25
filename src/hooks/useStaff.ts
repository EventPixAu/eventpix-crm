import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

// Profile-based staff (users with photographer role or any authenticated user for assignment)
export interface StaffProfile {
  id: string;
  email: string;
  full_name: string | null;
  phone: string | null;
  status: string | null;
  default_role_id: string | null;
  default_role?: StaffRole | null;
}

export interface StaffRole {
  id: string;
  name: string;
}

// Fetch all profiles that can be assigned to events (active status)
export function useStaffProfiles() {
  return useQuery({
    queryKey: ['staff-profiles'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('profiles')
        .select(`
          id,
          email,
          full_name,
          phone,
          status,
          default_role_id,
          default_role:staff_roles!profiles_default_role_id_fkey (
            id,
            name
          )
        `)
        .or('status.is.null,status.eq.active')
        .order('full_name');
      
      if (error) throw error;
      return data as StaffProfile[];
    },
  });
}

// Fetch staff roles lookup
export function useStaffRoles() {
  return useQuery({
    queryKey: ['staff-roles'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('staff_roles')
        .select('*')
        .order('name');
      
      if (error) throw error;
      return data as StaffRole[];
    },
  });
}

// Staff directory interface (non-sensitive fields only)
export interface StaffDirectoryEntry {
  id: string;
  full_name: string | null;
  avatar_url: string | null;
  default_role_id: string | null;
  status: string | null;
  is_active: boolean | null;
  source?: 'profile' | 'staff';
}

// Fetch staff directory - combines profiles (with accounts) and staff (legacy/unlinked)
// This ensures all team members appear in assignment dropdowns
export function useStaffDirectory() {
  return useQuery({
    queryKey: ['staff-directory'],
    queryFn: async () => {
      // Fetch from staff_directory view (profiles with accounts)
      const { data: profileData, error: profileError } = await supabase
        .from('staff_directory')
        .select('*')
        .order('full_name');
      
      if (profileError) throw profileError;
      
      // Fetch from staff table (legacy/unlinked team members)
      const { data: staffData, error: staffError } = await supabase
        .from('staff')
        .select('id, name, status, user_id')
        .or('status.is.null,status.eq.active')
        .order('name');
      
      if (staffError) throw staffError;
      
      // Combine profiles and unlinked staff
      const profiles: StaffDirectoryEntry[] = (profileData || []).map(p => ({
        ...p,
        source: 'profile' as const,
      }));
      
      // Get profile IDs set for quick lookup
      const profileIds = new Set(profiles.map(p => p.id));
      
      // Add unlinked staff members (those without user_id linking to an existing profile)
      // Staff with user_id pointing to a profile should NOT be duplicated
      const unlinkedStaff: StaffDirectoryEntry[] = (staffData || [])
        .filter(s => !s.user_id || !profileIds.has(s.user_id))
        .map(s => ({
          id: s.id,
          full_name: s.name,
          avatar_url: null,
          default_role_id: null,
          status: s.status,
          is_active: s.status === 'active' || s.status === null,
          source: 'staff' as const,
        }));
      
      return [...profiles, ...unlinkedStaff].sort((a, b) => 
        (a.full_name || '').localeCompare(b.full_name || '')
      );
    },
  });
}

// Fetch all profiles for admin/ops contexts that need full profile data
// This relies on RLS to restrict access to admin/ops/sales roles
export function useProfiles() {
  return useQuery({
    queryKey: ['profiles'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .order('full_name');
      
      if (error) throw error;
      return data;
    },
  });
}

// Legacy hook - still reads from staff table for backward compatibility
export interface Staff {
  id: string;
  user_id: string | null;
  name: string;
  role: 'photographer' | 'videographer' | 'assistant';
  email: string;
  phone: string | null;
  status: 'active' | 'inactive';
  notes: string | null;
  location: string | null;
  created_at: string;
  updated_at: string;
}

export function useStaff() {
  return useQuery({
    queryKey: ['staff'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('staff')
        .select('*')
        .order('name');
      
      if (error) throw error;
      return data as Staff[];
    },
  });
}

export function useStaffMember(id: string | undefined) {
  return useQuery({
    queryKey: ['staff', id],
    queryFn: async () => {
      if (!id) return null;
      const { data, error } = await supabase
        .from('staff')
        .select('*')
        .eq('id', id)
        .single();
      
      if (error) throw error;
      return data as Staff;
    },
    enabled: !!id,
  });
}

export function useCreateStaff() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (staff: Omit<Staff, 'id' | 'created_at' | 'updated_at'>) => {
      const { data, error } = await supabase
        .from('staff')
        .insert(staff)
        .select()
        .single();
      
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['staff'] });
      toast({ title: 'Team member added successfully' });
    },
    onError: (error: Error) => {
      toast({ variant: 'destructive', title: 'Failed to add team member', description: error.message });
    },
  });
}

export function useUpdateStaff() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async ({ id, ...staff }: Partial<Staff> & { id: string }) => {
      const { data, error } = await supabase
        .from('staff')
        .update(staff)
        .eq('id', id)
        .select()
        .single();
      
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['staff'] });
      toast({ title: 'Team member updated successfully' });
    },
    onError: (error: Error) => {
      toast({ variant: 'destructive', title: 'Failed to update team member', description: error.message });
    },
  });
}

export function useDeleteStaff() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('staff')
        .delete()
        .eq('id', id);
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['staff'] });
      toast({ title: 'Team member deleted successfully' });
    },
    onError: (error: Error) => {
      toast({ variant: 'destructive', title: 'Failed to delete team member', description: error.message });
    },
  });
}
