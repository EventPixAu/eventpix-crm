/**
 * ADMIN CONTACT RELATIONSHIP TYPES HOOK
 * 
 * CRUD operations for the contact_relationship_types lookup table.
 * Used in Admin Lookups page for managing contact relationship options.
 */
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { toast } from 'sonner';

export interface ContactRelationshipType {
  id: string;
  name: string;
  description: string | null;
  is_active: boolean;
  sort_order: number;
  created_at: string;
}

// Fetch ALL contact relationship types (for admin management)
export function useAllRelationshipTypes() {
  return useQuery({
    queryKey: ['relationship-types', 'all'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('contact_relationship_types')
        .select('*')
        .order('name')
        .order('sort_order');
      
      if (error) throw error;
      return data as ContactRelationshipType[];
    },
  });
}

// Fetch ACTIVE relationship types only (for dropdowns)
export function useActiveRelationshipTypes() {
  return useQuery({
    queryKey: ['relationship-types', 'active'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('contact_relationship_types')
        .select('*')
        .eq('is_active', true)
        .order('name')
        .order('sort_order');
      
      if (error) throw error;
      return data as ContactRelationshipType[];
    },
  });
}

export function useCreateRelationshipType() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (name: string) => {
      // Get max sort_order
      const { data: maxData } = await supabase
        .from('contact_relationship_types')
        .select('sort_order')
        .order('sort_order', { ascending: false })
        .limit(1)
        .single();
      
      const nextOrder = (maxData?.sort_order || 0) + 1;

      const { data, error } = await supabase
        .from('contact_relationship_types')
        .insert({ name, sort_order: nextOrder })
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['relationship-types'] });
      toast.success('Relationship type created');
    },
    onError: (error: Error) => {
      toast.error('Failed to create: ' + error.message);
    },
  });
}

export function useUpdateRelationshipType() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, ...updates }: Partial<ContactRelationshipType> & { id: string }) => {
      const { data, error } = await supabase
        .from('contact_relationship_types')
        .update(updates)
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['relationship-types'] });
      toast.success('Relationship type updated');
    },
    onError: (error: Error) => {
      toast.error('Failed to update: ' + error.message);
    },
  });
}
