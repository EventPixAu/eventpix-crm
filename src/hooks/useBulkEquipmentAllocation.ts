import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

interface BulkAllocationParams {
  eventId: string;
  userIds: string[];
  equipmentItemId?: string;
  kitId?: string;
}

interface AllocationResult {
  userId: string;
  success: boolean;
  error?: string;
}

export function useBulkAllocateEquipment() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      eventId,
      userIds,
      equipmentItemId,
      kitId,
    }: BulkAllocationParams): Promise<AllocationResult[]> => {
      const results: AllocationResult[] = [];

      for (const userId of userIds) {
        try {
          if (kitId) {
            // Get kit items
            const { data: kitItems, error: kitError } = await supabase
              .from('equipment_kit_items')
              .select('equipment_item_id')
              .eq('kit_id', kitId);

            if (kitError) throw kitError;

            // Allocate each kit item
            const allocations = kitItems.map((item) => ({
              event_id: eventId,
              equipment_item_id: item.equipment_item_id,
              user_id: userId,
              status: 'allocated' as const,
            }));

            const { error } = await supabase.from('equipment_allocations').insert(allocations);

            if (error) throw error;

            results.push({ userId, success: true });
          } else if (equipmentItemId) {
            // Allocate single item
            const { error } = await supabase.from('equipment_allocations').insert({
              event_id: eventId,
              equipment_item_id: equipmentItemId,
              user_id: userId,
              status: 'allocated',
            });

            if (error) throw error;

            results.push({ userId, success: true });
          }
        } catch (error: any) {
          let errorMessage = 'Unknown error';
          if (error.message?.includes('unique') || error.message?.includes('duplicate')) {
            errorMessage = 'Item already allocated';
          } else if (error.message) {
            errorMessage = error.message;
          }
          results.push({ userId, success: false, error: errorMessage });
        }
      }

      return results;
    },
    onSuccess: (results, { eventId }) => {
      // Invalidate relevant queries
      queryClient.invalidateQueries({ queryKey: ['equipment-allocations', eventId] });
      queryClient.invalidateQueries({ queryKey: ['equipment-items'] });

      // Also invalidate user-specific allocation queries
      results.forEach((r) => {
        if (r.success) {
          queryClient.invalidateQueries({ queryKey: ['equipment-allocations', 'user', r.userId] });
        }
      });
    },
  });
}
