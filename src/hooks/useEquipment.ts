import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

// Category is now a dynamic string from equipment_categories lookup
export type EquipmentCondition = 'excellent' | 'good' | 'needs_service' | 'out_of_service';
export type EquipmentStatus = 'available' | 'allocated' | 'in_service' | 'retired';

export interface EquipmentItem {
  id: string;
  name: string;
  category: string; // Now dynamic from lookup table
  brand: string | null;
  model: string | null;
  serial_number: string | null;
  condition: EquipmentCondition;
  status: EquipmentStatus;
  notes: string | null;
  created_at: string;
  owner_user_id: string | null; // null = EventPix company equipment, UUID = photographer-owned
}

export interface EquipmentItemWithOwner extends EquipmentItem {
  owner?: {
    id: string;
    full_name: string | null;
  } | null;
}

export function useEquipmentItems() {
  return useQuery({
    queryKey: ['equipment-items'],
    queryFn: async () => {
      // First fetch equipment items
      const { data: items, error } = await supabase
        .from('equipment_items')
        .select('*')
        .order('name');

      if (error) throw error;
      if (!items || items.length === 0) return [] as EquipmentItemWithOwner[];
      
      // Get unique owner IDs
      const ownerIds = [...new Set(
        items.map(i => i.owner_user_id).filter((id): id is string => !!id)
      )];
      
      // Fetch owner profiles if any
      let owners: Record<string, { id: string; full_name: string | null }> = {};
      if (ownerIds.length > 0) {
        const { data: profiles } = await supabase
          .from('profiles')
          .select('id, full_name')
          .in('id', ownerIds);
        
        if (profiles) {
          owners = Object.fromEntries(profiles.map(p => [p.id, p]));
        }
      }
      
      // Combine items with owners
      return items.map(item => ({
        ...item,
        owner: item.owner_user_id ? owners[item.owner_user_id] || null : null,
      })) as EquipmentItemWithOwner[];
    },
  });
}

export function useAvailableEquipment() {
  return useQuery({
    queryKey: ['equipment-items', 'available'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('equipment_items')
        .select('*')
        .eq('status', 'available')
        .order('name');

      if (error) throw error;
      return data as EquipmentItem[];
    },
  });
}

export function useCreateEquipmentItem() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (item: Omit<EquipmentItem, 'id' | 'created_at'>) => {
      const { data, error } = await supabase
        .from('equipment_items')
        .insert(item)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['equipment-items'] });
      toast.success('Equipment item added');
    },
    onError: (error) => {
      toast.error('Failed to add item: ' + error.message);
    },
  });
}

export function useUpdateEquipmentItem() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, ...updates }: Partial<EquipmentItem> & { id: string }) => {
      const { data, error } = await supabase
        .from('equipment_items')
        .update(updates)
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['equipment-items'] });
      toast.success('Equipment item updated');
    },
    onError: (error) => {
      toast.error('Failed to update item: ' + error.message);
    },
  });
}

export function useDeleteEquipmentItem() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('equipment_items')
        .delete()
        .eq('id', id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['equipment-items'] });
      toast.success('Equipment item deleted');
    },
    onError: (error) => {
      toast.error('Failed to delete item: ' + error.message);
    },
  });
}

// Legacy static categories - kept for backward compatibility in filters
export const EQUIPMENT_CATEGORIES: { value: string; label: string }[] = [
  { value: 'camera', label: 'Camera' },
  { value: 'lens', label: 'Lens' },
  { value: 'flash', label: 'Flash' },
  { value: 'battery', label: 'Battery' },
  { value: 'audio', label: 'Audio' },
  { value: 'video', label: 'Video' },
  { value: 'tripod', label: 'Tripod' },
  { value: 'accessory', label: 'Accessory' },
  { value: 'computer', label: 'Computer' },
  { value: 'other', label: 'Other' },
];

export const EQUIPMENT_CONDITIONS: { value: EquipmentCondition; label: string }[] = [
  { value: 'excellent', label: 'Excellent' },
  { value: 'good', label: 'Good' },
  { value: 'needs_service', label: 'Needs Service' },
  { value: 'out_of_service', label: 'Out of Service' },
];
