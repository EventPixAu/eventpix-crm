import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

export interface CoveragePackage {
  id: string;
  name: string;
  description: string | null;
  hours_included: number | null;
  photographers_included: number;
  is_active: boolean;
  sort_order: number;
  created_at: string;
  updated_at: string;
}

export type CoveragePackageInsert = Pick<CoveragePackage, 'name'> & 
  Partial<Pick<CoveragePackage, 'description' | 'hours_included' | 'photographers_included' | 'is_active' | 'sort_order'>>;

export type CoveragePackageUpdate = Partial<CoveragePackageInsert>;

export function useCoveragePackages() {
  return useQuery({
    queryKey: ['coverage-packages'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('coverage_packages')
        .select('*')
        .order('name')
        .order('sort_order');
      
      if (error) throw error;
      return data as CoveragePackage[];
    },
  });
}

export function useActiveCoveragePackages() {
  return useQuery({
    queryKey: ['coverage-packages', 'active'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('coverage_packages')
        .select('*')
        .eq('is_active', true)
        .order('name')
        .order('sort_order');
      
      if (error) throw error;
      return data as CoveragePackage[];
    },
  });
}

export function useCreateCoveragePackage() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (pkg: CoveragePackageInsert) => {
      const { data, error } = await supabase
        .from('coverage_packages')
        .insert(pkg)
        .select()
        .single();
      
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['coverage-packages'] });
      toast.success('Coverage package created successfully');
    },
    onError: (error) => {
      toast.error('Error creating coverage package', { description: error.message });
    },
  });
}

export function useUpdateCoveragePackage() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, ...updates }: CoveragePackageUpdate & { id: string }) => {
      const { data, error } = await supabase
        .from('coverage_packages')
        .update(updates)
        .eq('id', id)
        .select()
        .single();
      
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['coverage-packages'] });
      toast.success('Coverage package updated successfully');
    },
    onError: (error) => {
      toast.error('Error updating coverage package', { description: error.message });
    },
  });
}
