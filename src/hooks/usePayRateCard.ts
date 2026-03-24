import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

export interface PayRateCardEntry {
  id: string;
  staff_role_id: string;
  hourly_rate: number;
  minimum_paid_hours: number;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface SeriesFixedRate {
  id: string;
  series_id: string;
  staff_role_id: string;
  fixed_rate: number;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export function usePayRateCard() {
  return useQuery({
    queryKey: ['pay-rate-card'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('pay_rate_card')
        .select('*, staff_roles:staff_role_id(id, name)')
        .order('created_at', { ascending: true });
      if (error) throw error;
      return data as (PayRateCardEntry & { staff_roles: { id: string; name: string } })[];
    },
  });
}

export function useUpsertPayRate() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (entry: { id?: string; staff_role_id: string; hourly_rate: number; minimum_paid_hours: number; notes?: string | null }) => {
      if (entry.id) {
        const { error } = await supabase.from('pay_rate_card').update({
          hourly_rate: entry.hourly_rate,
          minimum_paid_hours: entry.minimum_paid_hours,
          notes: entry.notes ?? null,
          updated_at: new Date().toISOString(),
        }).eq('id', entry.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from('pay_rate_card').insert({
          staff_role_id: entry.staff_role_id,
          hourly_rate: entry.hourly_rate,
          minimum_paid_hours: entry.minimum_paid_hours,
          notes: entry.notes ?? null,
        });
        if (error) throw error;
      }
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['pay-rate-card'] }); toast.success('Rate saved'); },
    onError: (e) => toast.error('Failed: ' + e.message),
  });
}

export function useDeletePayRate() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('pay_rate_card').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['pay-rate-card'] }); toast.success('Rate removed'); },
    onError: (e) => toast.error('Failed: ' + e.message),
  });
}

export function useSeriesFixedRates(seriesId?: string) {
  return useQuery({
    queryKey: ['series-fixed-rates', seriesId],
    queryFn: async () => {
      if (!seriesId) return [];
      const { data, error } = await supabase
        .from('series_fixed_rates')
        .select('*, staff_roles:staff_role_id(id, name)')
        .eq('series_id', seriesId)
        .order('created_at');
      if (error) throw error;
      return data as (SeriesFixedRate & { staff_roles: { id: string; name: string } })[];
    },
    enabled: !!seriesId,
  });
}

export function useUpsertSeriesFixedRate() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (entry: { id?: string; series_id: string; staff_role_id: string; fixed_rate: number; notes?: string | null }) => {
      if (entry.id) {
        const { error } = await supabase.from('series_fixed_rates').update({
          fixed_rate: entry.fixed_rate,
          notes: entry.notes ?? null,
          updated_at: new Date().toISOString(),
        }).eq('id', entry.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from('series_fixed_rates').insert({
          series_id: entry.series_id,
          staff_role_id: entry.staff_role_id,
          fixed_rate: entry.fixed_rate,
          notes: entry.notes ?? null,
        });
        if (error) throw error;
      }
    },
    onSuccess: (_, vars) => { qc.invalidateQueries({ queryKey: ['series-fixed-rates', vars.series_id] }); toast.success('Series rate saved'); },
    onError: (e) => toast.error('Failed: ' + e.message),
  });
}

export interface PayAllowance {
  id: string;
  name: string;
  amount: number;
  unit: 'flat' | 'per_hour';
  is_active: boolean;
  sort_order: number;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export function usePayAllowances() {
  return useQuery({
    queryKey: ['pay-allowances'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('pay_allowances')
        .select('*')
        .order('sort_order');
      if (error) throw error;
      return data as PayAllowance[];
    },
  });
}

export function useUpsertPayAllowance() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (entry: { id?: string; name: string; amount: number; unit: string; notes?: string | null; is_active?: boolean; sort_order?: number }) => {
      if (entry.id) {
        const { error } = await supabase.from('pay_allowances').update({
          name: entry.name,
          amount: entry.amount,
          unit: entry.unit,
          notes: entry.notes ?? null,
          is_active: entry.is_active ?? true,
          updated_at: new Date().toISOString(),
        }).eq('id', entry.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from('pay_allowances').insert({
          name: entry.name,
          amount: entry.amount,
          unit: entry.unit,
          notes: entry.notes ?? null,
          sort_order: entry.sort_order ?? 0,
        });
        if (error) throw error;
      }
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['pay-allowances'] }); toast.success('Allowance saved'); },
    onError: (e) => toast.error('Failed: ' + e.message),
  });
}

export function useDeletePayAllowance() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('pay_allowances').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['pay-allowances'] }); toast.success('Allowance removed'); },
    onError: (e) => toast.error('Failed: ' + e.message),
  });
}

/**
 * Calculate pay for an assignment based on rate card + session duration.
 * Formula: minimum_paid_hours applies first (e.g. 3hrs min for a 2hr session),
 * then hourly rate × max(actual_hours, minimum_paid_hours).
 * 
 * For series with fixed rates, the fixed rate overrides the calculation.
 */
export function calculatePayFromRateCard(
  hourlyRate: number,
  minimumPaidHours: number,
  sessionDurationHours: number
): number {
  const paidHours = Math.max(sessionDurationHours, minimumPaidHours);
  return hourlyRate * paidHours;
}
