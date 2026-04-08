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
  kit_id: string | null;
  session_id: string | null;
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
  equipment_kit?: {
    id: string;
    name: string;
    other_items: string[] | null;
  } | null;
  session?: {
    id: string;
    session_date: string;
    label: string | null;
    start_time: string | null;
    end_time: string | null;
  } | null;
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
          profile:profiles(full_name, email),
          equipment_kit:equipment_kits(id, name, other_items),
          session:event_sessions(id, session_date, label, start_time, end_time)
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
    mutationFn: async ({ eventId, equipmentItemId, userId, sessionId }: { eventId: string; equipmentItemId: string; userId?: string; sessionId?: string }) => {
      const { data, error } = await supabase
        .from('equipment_allocations')
        .insert({
          event_id: eventId,
          equipment_item_id: equipmentItemId,
          user_id: userId || null,
          session_id: sessionId || null,
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
    mutationFn: async ({ eventId, kitId, userId, sessionId }: { eventId: string; kitId: string; userId?: string; sessionId?: string }) => {
      // Get kit items
      const { data: kitItems, error: kitError } = await supabase
        .from('equipment_kit_items')
        .select('equipment_item_id')
        .eq('kit_id', kitId);

      if (kitError) throw kitError;

      // Check which items are already allocated for this event+session
      const targetSessionId = sessionId || null;
      const { data: existingAllocations } = await supabase
        .from('equipment_allocations')
        .select('equipment_item_id, session_id')
        .eq('event_id', eventId)
        .in('equipment_item_id', kitItems.map(i => i.equipment_item_id))
        .is('returned_at', null)
        .not('status', 'in', '("returned","missing")');

      // Filter out items already allocated to this specific session
      const alreadyAllocatedIds = new Set(
        (existingAllocations || [])
          .filter(a => a.session_id === targetSessionId)
          .map(a => a.equipment_item_id)
      );

      const newItems = kitItems.filter(i => !alreadyAllocatedIds.has(i.equipment_item_id));

      // Note how many were on other sessions
      const onOtherSessions = (existingAllocations || [])
        .filter(a => a.session_id !== targetSessionId)
        .length;

      if (newItems.length === 0) {
        return { inserted: [], skippedSameSession: alreadyAllocatedIds.size, onOtherSessions };
      }

      const allocations = newItems.map((item) => ({
        event_id: eventId,
        equipment_item_id: item.equipment_item_id,
        user_id: userId || null,
        session_id: targetSessionId,
        kit_id: kitId,
        status: 'allocated' as const,
      }));

      const { data, error } = await supabase
        .from('equipment_allocations')
        .insert(allocations)
        .select();

      if (error) throw error;
      return { inserted: data, skippedSameSession: alreadyAllocatedIds.size, onOtherSessions };
    },
    onSuccess: (result, { eventId }) => {
      queryClient.invalidateQueries({ queryKey: ['equipment-allocations', eventId] });
      queryClient.invalidateQueries({ queryKey: ['equipment-items'] });
      
      const { inserted, skippedSameSession, onOtherSessions } = result;
      if (inserted.length === 0 && skippedSameSession > 0) {
        toast.info('All items already allocated to this session');
      } else {
        let msg = `${inserted.length} item(s) allocated`;
        if (onOtherSessions > 0) {
          msg += ` (also allocated on ${onOtherSessions} other session(s))`;
        }
        if (skippedSameSession > 0) {
          msg += ` — ${skippedSameSession} already on this session`;
        }
        toast.success(msg);
      }
    },
    onError: (error) => {
      toast.error('Failed to allocate kit: ' + error.message);
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
      userId,
      eventId 
    }: { 
      id: string; 
      status: AllocationStatus; 
      notes?: string;
      userId?: string | null;
      eventId: string 
    }) => {
      const updates: Partial<EquipmentAllocation> & { user_id?: string | null } = { status };
      
      if (notes) updates.notes = notes;
      if (status === 'returned') updates.returned_at = new Date().toISOString();
      if (userId !== undefined) updates.user_id = userId;

      const { data, error } = await supabase
        .from('equipment_allocations')
        .update(updates)
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: (_, { eventId, userId }) => {
      queryClient.invalidateQueries({ queryKey: ['equipment-allocations', eventId] });
      queryClient.invalidateQueries({ queryKey: ['equipment-items'] });
      toast.success(userId !== undefined ? 'Assignment updated' : 'Status updated');
    },
    onError: (error) => {
      toast.error('Failed to update: ' + error.message);
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

          // For photographer-owned gear, first return any prior active allocation
          // so the unique index allows re-allocation to this event
          const { data: existing } = await supabase
            .from('equipment_allocations')
            .select('id, event_id')
            .eq('equipment_item_id', equipmentItemId)
            .is('returned_at', null)
            .not('status', 'in', '("returned","missing")')
            .maybeSingle();

          if (existing && existing.event_id === eventId) {
            // Already allocated to this event — skip
            continue;
          }

          if (existing) {
            // Return the prior allocation so we can re-allocate to this event
            await supabase
              .from('equipment_allocations')
              .update({ status: 'returned', returned_at: new Date().toISOString() })
              .eq('id', existing.id);
          }

          if (!existing) {
            allAllocations.push({
              event_id: eventId,
              equipment_item_id: equipmentItemId,
              user_id: kit.userId,
              status: 'allocated',
            });
          }
        }
      }

      // Deduplicate by equipment_item_id to avoid unique constraint violations
      const seen = new Set<string>();
      const uniqueAllocations = allAllocations.filter(a => {
        if (seen.has(a.equipment_item_id)) return false;
        seen.add(a.equipment_item_id);
        return true;
      });

      if (uniqueAllocations.length === 0) {
        return []; // All items already allocated
      }

      // Insert only new allocations
      const { data, error } = await supabase
        .from('equipment_allocations')
        .insert(uniqueAllocations)
        .select();

      if (error) throw error;
      return data;
    },
    onSuccess: (data, { eventId }) => {
      queryClient.invalidateQueries({ queryKey: ['equipment-allocations', eventId] });
      queryClient.invalidateQueries({ queryKey: ['equipment-items'] });
      queryClient.invalidateQueries({ queryKey: ['photographer-equipment'] });
      if (data.length === 0) {
        toast.info('All items already allocated — nothing new to add');
      } else {
        toast.success(`${data.length} item(s) allocated to event`);
      }
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
