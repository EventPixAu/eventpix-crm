/**
 * CONTACT ROLES HOOK
 * 
 * Provides data access for the contact_roles lookup table.
 * Used for client contact role dropdown options.
 */
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { toast } from 'sonner';

export interface ContactRole {
  id: string;
  name: string;
  is_active: boolean;
  sort_order: number;
  created_at: string;
  updated_at: string;
}

// Returns ACTIVE contact roles only
export function useContactRoles() {
  return useQuery({
    queryKey: ['contact-roles', 'active'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('contact_roles')
        .select('*')
        .eq('is_active', true)
        .order('sort_order')
        .order('name');
      
      if (error) throw error;
      return data as ContactRole[];
    },
  });
}

// Returns ALL contact roles for admin
export function useAllContactRoles() {
  return useQuery({
    queryKey: ['contact-roles', 'all'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('contact_roles')
        .select('*')
        .order('sort_order')
        .order('name');
      
      if (error) throw error;
      return data as ContactRole[];
    },
  });
}

export function useCreateContactRole() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (name: string) => {
      const { data: maxData } = await supabase
        .from('contact_roles')
        .select('sort_order')
        .order('sort_order', { ascending: false })
        .limit(1)
        .single();
      
      const nextOrder = (maxData?.sort_order || 0) + 1;

      const { data, error } = await supabase
        .from('contact_roles')
        .insert({ name, sort_order: nextOrder })
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['contact-roles'] });
      toast.success('Contact role created');
    },
    onError: (error: Error) => {
      toast.error('Failed to create: ' + error.message);
    },
  });
}

export function useUpdateContactRole() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, ...updates }: Partial<ContactRole> & { id: string }) => {
      const { data, error } = await supabase
        .from('contact_roles')
        .update(updates)
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['contact-roles'] });
      toast.success('Contact role updated');
    },
    onError: (error: Error) => {
      toast.error('Failed to update: ' + error.message);
    },
  });
}
