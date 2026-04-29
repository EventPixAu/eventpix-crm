/**
 * ADMIN STAFF ROLES HOOK
 * 
 * CRUD operations for the staff_roles lookup table.
 * Used in Admin Lookups page for managing staff role options.
 */
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { toast } from 'sonner';

export interface StaffRoleLookup {
  id: string;
  name: string;
  description: string | null;
  is_active: boolean;
  sort_order: number;
  created_at: string;
}

// Fetch ALL staff roles (for admin management)
export function useAllStaffRoles() {
  return useQuery({
    queryKey: ['staff-roles', 'all'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('staff_roles')
        .select('*')
        .order('name')
        .order('sort_order');
      
      if (error) throw error;
      return data as StaffRoleLookup[];
    },
  });
}

export function useCreateStaffRole() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (name: string) => {
      // Get max sort_order
      const { data: maxData } = await supabase
        .from('staff_roles')
        .select('sort_order')
        .order('sort_order', { ascending: false })
        .limit(1)
        .single();
      
      const nextOrder = (maxData?.sort_order || 0) + 1;

      const { data, error } = await supabase
        .from('staff_roles')
        .insert({ name, sort_order: nextOrder })
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['staff-roles'] });
      toast.success('Staff role created');
    },
    onError: (error: Error) => {
      toast.error('Failed to create: ' + error.message);
    },
  });
}

export function useUpdateStaffRole() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, ...updates }: Partial<StaffRoleLookup> & { id: string }) => {
      const { data, error } = await supabase
        .from('staff_roles')
        .update(updates)
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['staff-roles'] });
      toast.success('Staff role updated');
    },
    onError: (error: Error) => {
      toast.error('Failed to update: ' + error.message);
    },
  });
}
