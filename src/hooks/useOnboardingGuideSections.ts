import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { toast } from 'sonner';

export interface OnboardingGuideSection {
  id: string;
  section_key: string;
  title: string;
  icon: string;
  sort_order: number;
  body_markdown: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export type OnboardingGuideSectionInput = Pick<
  OnboardingGuideSection,
  'section_key' | 'title' | 'icon' | 'sort_order' | 'body_markdown' | 'is_active'
>;

const KEY = ['onboarding-guide-sections'] as const;

export function useOnboardingGuideSections(opts?: { includeInactive?: boolean }) {
  const includeInactive = opts?.includeInactive ?? false;
  return useQuery({
    queryKey: [...KEY, { includeInactive }],
    queryFn: async () => {
      let query = supabase
        .from('onboarding_guide_sections' as any)
        .select('*')
        .order('sort_order', { ascending: true });

      if (!includeInactive) query = query.eq('is_active', true);

      const { data, error } = await query;
      if (error) throw error;
      return (data ?? []) as unknown as OnboardingGuideSection[];
    },
  });
}

export function useUpsertOnboardingGuideSection() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: Partial<OnboardingGuideSection> & { id?: string }) => {
      if (input.id) {
        const { id, ...updates } = input;
        const { data, error } = await supabase
          .from('onboarding_guide_sections' as any)
          .update(updates)
          .eq('id', id)
          .select()
          .maybeSingle();
        if (error) throw error;
        return data;
      }
      const { data, error } = await supabase
        .from('onboarding_guide_sections' as any)
        .insert(input as any)
        .select()
        .maybeSingle();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: KEY });
      toast.success('Section saved');
    },
    onError: (err: any) => toast.error('Save failed: ' + err.message),
  });
}

export function useDeleteOnboardingGuideSection() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('onboarding_guide_sections' as any)
        .delete()
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: KEY });
      toast.success('Section deleted');
    },
    onError: (err: any) => toast.error('Delete failed: ' + err.message),
  });
}
