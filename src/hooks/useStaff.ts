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

// Fetch all profiles for assignment
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
      toast({ title: 'Staff member added successfully' });
    },
    onError: (error: Error) => {
      toast({ variant: 'destructive', title: 'Failed to add staff', description: error.message });
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
      toast({ title: 'Staff member updated successfully' });
    },
    onError: (error: Error) => {
      toast({ variant: 'destructive', title: 'Failed to update staff', description: error.message });
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
      toast({ title: 'Staff member deleted successfully' });
    },
    onError: (error: Error) => {
      toast({ variant: 'destructive', title: 'Failed to delete staff', description: error.message });
    },
  });
}
