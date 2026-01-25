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
      const { data, error } = await supabase
        .from('equipment_items')
        .select(`
          *,
          owner:profiles!equipment_items_owner_user_id_fkey (
            id,
            full_name
          )
        `)
        .order('name');

      if (error) throw error;
      
      // Transform the result - owner might come back as array for some FK configs
      return (data || []).map(item => {
        const ownerData = item.owner;
        // Handle both array and object forms from Supabase
        const owner = Array.isArray(ownerData) 
          ? (ownerData[0] as { id: string; full_name: string | null } | undefined) || null
          : (ownerData as { id: string; full_name: string | null } | null);
        
        return {
          ...item,
          owner,
        };
      }) as EquipmentItemWithOwner[];
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
