import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import type { EquipmentItem } from './useEquipment';

export type AllocationStatus = 'allocated' | 'picked_up' | 'returned' | 'missing' | 'damaged';

export interface EquipmentAllocation {
  id: string;
  event_id: string;
  user_id: string | null;
  equipment_item_id: string;
  allocated_at: string;
  returned_at: string | null;
  status: AllocationStatus;
  notes: string | null;
  created_at: string;
}

export interface EquipmentAllocationWithDetails extends EquipmentAllocation {
  equipment_item: EquipmentItem;
  profile?: {
    full_name: string | null;
    email: string;
  };
}

export function useEventAllocations(eventId: string | undefined) {
  return useQuery({
    queryKey: ['equipment-allocations', eventId],
    queryFn: async () => {
      if (!eventId) return [];

      const { data, error } = await supabase
        .from('equipment_allocations')
        .select(`
          *,
          equipment_item:equipment_items(*),
          profile:profiles(full_name, email)
        `)
        .eq('event_id', eventId)
        .order('created_at', { ascending: false });

      if (error) throw error;
      return data as EquipmentAllocationWithDetails[];
    },
    enabled: !!eventId,
  });
}

export function useUserAllocations(userId: string | undefined) {
  return useQuery({
    queryKey: ['equipment-allocations', 'user', userId],
    queryFn: async () => {
      if (!userId) return [];

      const { data, error } = await supabase
        .from('equipment_allocations')
        .select(`
          *,
          equipment_item:equipment_items(*),
          event:events(id, event_name, event_date)
        `)
        .eq('user_id', userId)
        .order('allocated_at', { ascending: false });

      if (error) throw error;
      return data;
    },
    enabled: !!userId,
  });
}

export function useItemAllocations(equipmentItemId: string | undefined) {
  return useQuery({
    queryKey: ['equipment-allocations', 'item', equipmentItemId],
    queryFn: async () => {
      if (!equipmentItemId) return [];

      const { data, error } = await supabase
        .from('equipment_allocations')
        .select(`
          *,
          event:events(id, event_name, event_date)
        `)
        .eq('equipment_item_id', equipmentItemId)
        .order('allocated_at', { ascending: false })
        .limit(10);

      if (error) throw error;
      return data;
    },
    enabled: !!equipmentItemId,
  });
}

export function useAllocateEquipment() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ eventId, equipmentItemId, userId }: { eventId: string; equipmentItemId: string; userId?: string }) => {
      const { data, error } = await supabase
        .from('equipment_allocations')
        .insert({
          event_id: eventId,
          equipment_item_id: equipmentItemId,
          user_id: userId || null,
          status: 'allocated',
        })
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: (_, { eventId }) => {
      queryClient.invalidateQueries({ queryKey: ['equipment-allocations', eventId] });
      queryClient.invalidateQueries({ queryKey: ['equipment-items'] });
      toast.success('Equipment allocated');
    },
    onError: (error) => {
      if (error.message.includes('unique')) {
        toast.error('This item is already allocated to another event');
      } else {
        toast.error('Failed to allocate: ' + error.message);
      }
    },
  });
}

export function useAllocateKit() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ eventId, kitId, userId }: { eventId: string; kitId: string; userId?: string }) => {
      // Get kit items
      const { data: kitItems, error: kitError } = await supabase
        .from('equipment_kit_items')
        .select('equipment_item_id')
        .eq('kit_id', kitId);

      if (kitError) throw kitError;

      // Allocate each item
      const allocations = kitItems.map((item) => ({
        event_id: eventId,
        equipment_item_id: item.equipment_item_id,
        user_id: userId || null,
        status: 'allocated' as const,
      }));

      const { data, error } = await supabase
        .from('equipment_allocations')
        .insert(allocations)
        .select();

      if (error) throw error;
      return data;
    },
    onSuccess: (_, { eventId }) => {
      queryClient.invalidateQueries({ queryKey: ['equipment-allocations', eventId] });
      queryClient.invalidateQueries({ queryKey: ['equipment-items'] });
      toast.success('Kit allocated to event');
    },
    onError: (error) => {
      if (error.message.includes('unique')) {
        toast.error('Some items in this kit are already allocated');
      } else {
        toast.error('Failed to allocate kit: ' + error.message);
      }
    },
  });
}

export function useUpdateAllocationStatus() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ 
      id, 
      status, 
      notes, 
      eventId 
    }: { 
      id: string; 
      status: AllocationStatus; 
      notes?: string; 
      eventId: string 
    }) => {
      const updates: Partial<EquipmentAllocation> = { status };
      
      if (notes) updates.notes = notes;
      if (status === 'returned') updates.returned_at = new Date().toISOString();

      const { data, error } = await supabase
        .from('equipment_allocations')
        .update(updates)
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: (_, { eventId }) => {
      queryClient.invalidateQueries({ queryKey: ['equipment-allocations', eventId] });
      queryClient.invalidateQueries({ queryKey: ['equipment-items'] });
      toast.success('Status updated');
    },
    onError: (error) => {
      toast.error('Failed to update status: ' + error.message);
    },
  });
}

export function useRemoveAllocation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, eventId }: { id: string; eventId: string }) => {
      const { error } = await supabase
        .from('equipment_allocations')
        .delete()
        .eq('id', id);

      if (error) throw error;
      return eventId;
    },
    onSuccess: (eventId) => {
      queryClient.invalidateQueries({ queryKey: ['equipment-allocations', eventId] });
      queryClient.invalidateQueries({ queryKey: ['equipment-items'] });
      toast.success('Allocation removed');
    },
    onError: (error) => {
      toast.error('Failed to remove allocation: ' + error.message);
    },
  });
}

export function useAllocatePhotographerKits() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ 
      eventId, 
      kits 
    }: { 
      eventId: string; 
      kits: Array<{ userId: string; category: string; items: Array<{ name: string; }> }> 
    }) => {
      const allAllocations: Array<{ event_id: string; equipment_item_id: string; user_id: string; status: string }> = [];

      // Process each kit
      for (const kit of kits) {
        for (const item of kit.items) {
          // Check if this equipment item already exists for this photographer
          const { data: existingItems } = await supabase
            .from('equipment_items')
            .select('id')
            .eq('name', item.name)
            .eq('owner_user_id', kit.userId)
            .maybeSingle();

          let equipmentItemId: string;

          if (existingItems) {
            equipmentItemId = existingItems.id;
          } else {
            // Create new equipment item for this photographer
            const { data: newItem, error: createError } = await supabase
              .from('equipment_items')
              .insert({
                name: item.name,
                category: kit.category,
                owner_user_id: kit.userId,
                status: 'available',
                condition: 'good',
              })
              .select('id')
              .single();

            if (createError) throw createError;
            equipmentItemId = newItem.id;
          }

          // Add to allocations list
          allAllocations.push({
            event_id: eventId,
            equipment_item_id: equipmentItemId,
            user_id: kit.userId,
            status: 'allocated',
          });
        }
      }

      // Insert all allocations
      const { data, error } = await supabase
        .from('equipment_allocations')
        .insert(allAllocations)
        .select();

      if (error) throw error;
      return data;
    },
    onSuccess: (_, { eventId }) => {
      queryClient.invalidateQueries({ queryKey: ['equipment-allocations', eventId] });
      queryClient.invalidateQueries({ queryKey: ['equipment-items'] });
      queryClient.invalidateQueries({ queryKey: ['photographer-equipment'] });
      toast.success('Photographer kits allocated to event');
    },
    onError: (error) => {
      console.error('Failed to allocate photographer kits:', error);
      toast.error('Failed to allocate photographer kits: ' + error.message);
    },
  });
}

export const ALLOCATION_STATUS_CONFIG: Record<AllocationStatus, { label: string; color: string }> = {
  allocated: { label: 'Allocated', color: 'bg-blue-500' },
  picked_up: { label: 'Picked Up', color: 'bg-green-500' },
  returned: { label: 'Returned', color: 'bg-muted-foreground' },
  missing: { label: 'Missing', color: 'bg-destructive' },
  damaged: { label: 'Damaged', color: 'bg-orange-500' },
};
