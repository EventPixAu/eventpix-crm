import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { toast } from 'sonner';
import type { EquipmentItem } from './useEquipment';

export interface EquipmentKit {
  id: string;
  name: string;
  description: string | null;
  other_items: string[] | null;
  is_active: boolean;
  created_at: string;
}

export interface EquipmentKitItem {
  id: string;
  kit_id: string;
  equipment_item_id: string;
  quantity: number;
  created_at: string;
  equipment_item?: EquipmentItem;
}

export interface EquipmentKitWithItems extends EquipmentKit {
  items: EquipmentKitItem[];
}

export function useEquipmentKits() {
  return useQuery({
    queryKey: ['equipment-kits'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('equipment_kits')
        .select('*')
        .order('name');

      if (error) throw error;
      return data as EquipmentKit[];
    },
  });
}

export function useActiveEquipmentKits() {
  return useQuery({
    queryKey: ['equipment-kits', 'active'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('equipment_kits')
        .select('*')
        .eq('is_active', true)
        .order('name');

      if (error) throw error;
      return data as EquipmentKit[];
    },
  });
}

export function useEquipmentKit(kitId: string | undefined) {
  return useQuery({
    queryKey: ['equipment-kit', kitId],
    queryFn: async () => {
      if (!kitId) return null;

      const { data: kit, error: kitError } = await supabase
        .from('equipment_kits')
        .select('*')
        .eq('id', kitId)
        .single();

      if (kitError) throw kitError;

      const { data: items, error: itemsError } = await supabase
        .from('equipment_kit_items')
        .select(`
          *,
          equipment_item:equipment_items(*)
        `)
        .eq('kit_id', kitId);

      if (itemsError) throw itemsError;

      return {
        ...kit,
        items: items || [],
      } as EquipmentKitWithItems;
    },
    enabled: !!kitId,
  });
}

export function useCreateEquipmentKit() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (kit: Omit<EquipmentKit, 'id' | 'created_at'>) => {
      const { data, error } = await supabase
        .from('equipment_kits')
        .insert(kit)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['equipment-kits'] });
      toast.success('Equipment kit created');
    },
    onError: (error) => {
      toast.error('Failed to create kit: ' + error.message);
    },
  });
}

export function useUpdateEquipmentKit() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, ...updates }: Partial<EquipmentKit> & { id: string }) => {
      const { data, error } = await supabase
        .from('equipment_kits')
        .update(updates)
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: (_, { id }) => {
      queryClient.invalidateQueries({ queryKey: ['equipment-kits'] });
      queryClient.invalidateQueries({ queryKey: ['equipment-kit', id] });
      toast.success('Equipment kit updated');
    },
    onError: (error) => {
      toast.error('Failed to update kit: ' + error.message);
    },
  });
}

export function useAddKitItem() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ kitId, equipmentItemId, quantity = 1 }: { kitId: string; equipmentItemId: string; quantity?: number }) => {
      const { data, error } = await supabase
        .from('equipment_kit_items')
        .insert({ kit_id: kitId, equipment_item_id: equipmentItemId, quantity })
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: (_, { kitId }) => {
      queryClient.invalidateQueries({ queryKey: ['equipment-kit', kitId] });
      toast.success('Item added to kit');
    },
    onError: (error) => {
      toast.error('Failed to add item: ' + error.message);
    },
  });
}

export function useRemoveKitItem() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, kitId }: { id: string; kitId: string }) => {
      const { error } = await supabase
        .from('equipment_kit_items')
        .delete()
        .eq('id', id);

      if (error) throw error;
      return kitId;
    },
    onSuccess: (kitId) => {
      queryClient.invalidateQueries({ queryKey: ['equipment-kit', kitId] });
      toast.success('Item removed from kit');
    },
    onError: (error) => {
      toast.error('Failed to remove item: ' + error.message);
    },
  });
}
