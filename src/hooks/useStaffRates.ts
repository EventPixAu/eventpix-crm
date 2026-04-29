import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { toast } from 'sonner';

export type RateType = 'hourly' | 'half_day' | 'full_day' | 'event';

export interface StaffRate {
  id: string;
  user_id: string;
  rate_type: RateType;
  base_rate: number;
  currency: string;
  effective_from: string;
  effective_to: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface StaffRateWithProfile extends StaffRate {
  profiles: {
    full_name: string | null;
    email: string;
  };
}

export function useStaffRates() {
  return useQuery({
    queryKey: ['staff-rates'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('staff_rates')
        .select(`
          *,
          profiles:user_id (
            full_name,
            email
          )
        `)
        .order('effective_from', { ascending: false });

      if (error) throw error;
      return data as StaffRateWithProfile[];
    },
  });
}

export function useStaffRatesByUser(userId: string | undefined) {
  return useQuery({
    queryKey: ['staff-rates', userId],
    queryFn: async () => {
      if (!userId) return [];
      const { data, error } = await supabase
        .from('staff_rates')
        .select('*')
        .eq('user_id', userId)
        .order('effective_from', { ascending: false });

      if (error) throw error;
      return data as StaffRate[];
    },
    enabled: !!userId,
  });
}

export function useActiveStaffRate(userId: string | undefined) {
  return useQuery({
    queryKey: ['staff-rate-active', userId],
    queryFn: async () => {
      if (!userId) return null;
      const today = new Date().toISOString().split('T')[0];
      
      const { data, error } = await supabase
        .from('staff_rates')
        .select('*')
        .eq('user_id', userId)
        .lte('effective_from', today)
        .or(`effective_to.is.null,effective_to.gte.${today}`)
        .order('effective_from', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (error) throw error;
      return data as StaffRate | null;
    },
    enabled: !!userId,
  });
}

export function useCreateStaffRate() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (rate: Omit<StaffRate, 'id' | 'created_at' | 'updated_at'>) => {
      const { data, error } = await supabase
        .from('staff_rates')
        .insert(rate)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['staff-rates'] });
      toast.success('Staff rate added');
    },
    onError: (error) => {
      toast.error('Failed to add rate: ' + error.message);
    },
  });
}

export function useUpdateStaffRate() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, ...updates }: Partial<StaffRate> & { id: string }) => {
      const { data, error } = await supabase
        .from('staff_rates')
        .update(updates)
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['staff-rates'] });
      toast.success('Staff rate updated');
    },
    onError: (error) => {
      toast.error('Failed to update rate: ' + error.message);
    },
  });
}

export function useDeleteStaffRate() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('staff_rates')
        .delete()
        .eq('id', id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['staff-rates'] });
      toast.success('Staff rate deleted');
    },
    onError: (error) => {
      toast.error('Failed to delete rate: ' + error.message);
    },
  });
}

// Calculate estimated cost for an assignment
export function calculateEstimatedCost(
  rate: StaffRate | null,
  eventDurationHours: number | null
): number | null {
  if (!rate) return null;

  switch (rate.rate_type) {
    case 'hourly':
      return eventDurationHours ? rate.base_rate * eventDurationHours : null;
    case 'half_day':
      return rate.base_rate;
    case 'full_day':
      return rate.base_rate;
    case 'event':
      return rate.base_rate;
    default:
      return null;
  }
}
