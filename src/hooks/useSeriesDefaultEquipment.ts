import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { toast } from 'sonner';

export interface SeriesDefaultEquipment {
  id: string;
  series_id: string;
  equipment_item_id: string | null;
  kit_id: string | null;
  notes: string | null;
  sort_order: number;
  created_at: string;
  equipment_item?: {
    id: string;
    name: string;
    category: string;
    brand: string | null;
    model: string | null;
  } | null;
  kit?: {
    id: string;
    name: string;
    description: string | null;
  } | null;
}

export function useSeriesDefaultEquipment(seriesId: string | undefined) {
  return useQuery({
    queryKey: ['series-default-equipment', seriesId],
    queryFn: async () => {
      if (!seriesId) return [];
      const { data, error } = await supabase
        .from('series_default_equipment' as any)
        .select(`
          *,
          equipment_item:equipment_items(id, name, category, brand, model),
          kit:equipment_kits(id, name, description)
        `)
        .eq('series_id', seriesId)
        .order('sort_order');
      if (error) throw error;
      return (data || []) as unknown as SeriesDefaultEquipment[];
    },
    enabled: !!seriesId,
  });
}

export function useAddSeriesDefaultEquipment() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: {
      series_id: string;
      equipment_item_id?: string | null;
      kit_id?: string | null;
      notes?: string | null;
    }) => {
      const { data: existing } = await supabase
        .from('series_default_equipment' as any)
        .select('sort_order')
        .eq('series_id', input.series_id)
        .order('sort_order', { ascending: false })
        .limit(1);
      const nextOrder = ((existing?.[0] as any)?.sort_order ?? -1) + 1;

      const { data, error } = await supabase
        .from('series_default_equipment' as any)
        .insert({
          series_id: input.series_id,
          equipment_item_id: input.equipment_item_id ?? null,
          kit_id: input.kit_id ?? null,
          notes: input.notes ?? null,
          sort_order: nextOrder,
        })
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: (_, vars) => {
      qc.invalidateQueries({ queryKey: ['series-default-equipment', vars.series_id] });
      toast.success('Equipment added to series');
    },
    onError: (error: any) => {
      if (error.code === '23505') {
        toast.error('This item or kit is already added to the series');
      } else {
        toast.error('Failed to add equipment: ' + error.message);
      }
    },
  });
}

export function useRemoveSeriesDefaultEquipment() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, series_id }: { id: string; series_id: string }) => {
      const { error } = await supabase
        .from('series_default_equipment' as any)
        .delete()
        .eq('id', id);
      if (error) throw error;
      return series_id;
    },
    onSuccess: (series_id) => {
      qc.invalidateQueries({ queryKey: ['series-default-equipment', series_id] });
      toast.success('Removed');
    },
    onError: (e: any) => toast.error('Failed to remove: ' + e.message),
  });
}

// Sync default equipment to events in the series (upcoming events)
export function useSyncDefaultEquipmentToEvents() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({
      series_id,
      event_ids,
      defaults,
    }: {
      series_id: string;
      event_ids: string[];
      defaults: SeriesDefaultEquipment[];
    }) => {
      const results = { added: 0, skipped: 0, errors: [] as string[] };

      for (const eventId of event_ids) {
        for (const def of defaults) {
          // Resolve items to allocate
          let itemIds: string[] = [];
          if (def.equipment_item_id) {
            itemIds = [def.equipment_item_id];
          } else if (def.kit_id) {
            const { data: kitItems } = await supabase
              .from('equipment_kit_items')
              .select('equipment_item_id')
              .eq('kit_id', def.kit_id);
            itemIds = (kitItems || []).map((k) => k.equipment_item_id);
          }

          for (const equipment_item_id of itemIds) {
            const { data: existing } = await supabase
              .from('equipment_allocations')
              .select('id')
              .eq('event_id', eventId)
              .eq('equipment_item_id', equipment_item_id)
              .is('returned_at', null)
              .maybeSingle();
            if (existing) {
              results.skipped++;
              continue;
            }
            const { error } = await supabase.from('equipment_allocations').insert({
              event_id: eventId,
              equipment_item_id,
              kit_id: def.kit_id ?? null,
              status: 'allocated',
            });
            if (error) results.errors.push(error.message);
            else results.added++;
          }
        }
      }
      return results;
    },
    onSuccess: (results, vars) => {
      qc.invalidateQueries({ queryKey: ['equipment-allocations'] });
      qc.invalidateQueries({ queryKey: ['series-events', vars.series_id] });
      if (results.added) toast.success(`Allocated ${results.added} item(s) across events`);
      if (results.skipped) toast.info(`${results.skipped} already allocated (skipped)`);
      if (results.errors.length) toast.error(`${results.errors.length} error(s) occurred`);
    },
    onError: (e: any) => toast.error('Sync failed: ' + e.message),
  });
}
