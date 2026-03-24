/**
 * StaffEquipmentPreview - Shows a staff member's photography equipment kits
 * with optional checkboxes to select individual kits for allocation.
 */

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Loader2, CheckCircle } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Button } from '@/components/ui/button';
import {
  type StoredEquipment,
  type PhotographyEquipmentV2,
  type EquipmentKitV2,
  migrateToV2,
  CATEGORY_CONFIG,
} from './PhotographyEquipmentEditor';
import { useAllocatePhotographerKits } from '@/hooks/useEquipmentAllocations';
import { toast } from 'sonner';

interface StaffEquipmentPreviewProps {
  userId: string;
  /** When provided, enables kit selection checkboxes and allocate button */
  eventId?: string;
  sessionId?: string;
}

export function StaffEquipmentPreview({ userId, eventId, sessionId }: StaffEquipmentPreviewProps) {
  const [selectedKitIds, setSelectedKitIds] = useState<Set<string>>(new Set());
  const allocateKits = useAllocatePhotographerKits();

  const { data: v2Data, isLoading } = useQuery({
    queryKey: ['staff-equipment-profile', userId],
    queryFn: async (): Promise<PhotographyEquipmentV2 | null> => {
      const { data: profile } = await supabase
        .from('profiles')
        .select('photography_equipment_json')
        .eq('id', userId)
        .maybeSingle();

      if (profile?.photography_equipment_json) {
        return migrateToV2(profile.photography_equipment_json as unknown as StoredEquipment);
      }

      const { data: staff } = await supabase
        .from('staff')
        .select('photography_equipment_json')
        .eq('user_id', userId)
        .maybeSingle();

      if (staff?.photography_equipment_json) {
        return migrateToV2(staff.photography_equipment_json as unknown as StoredEquipment);
      }

      return null;
    },
    enabled: !!userId,
  });

  const selectable = !!eventId;

  const toggleKit = (kitId: string) => {
    setSelectedKitIds(prev => {
      const next = new Set(prev);
      if (next.has(kitId)) next.delete(kitId);
      else next.add(kitId);
      return next;
    });
  };

  const handleAllocateSelected = async () => {
    if (!eventId || !v2Data || selectedKitIds.size === 0) return;

    const kitsToAllocate = v2Data.kits
      .filter(k => selectedKitIds.has(k.id) && k.items.some(i => i.name?.trim()))
      .map(kit => ({
        userId,
        category: kit.category,
        items: kit.items.filter(i => i.name?.trim()),
      }));

    if (kitsToAllocate.length === 0) return;

    try {
      await allocateKits.mutateAsync({ eventId, kits: kitsToAllocate });
      setSelectedKitIds(new Set());
      toast.success(`${kitsToAllocate.length} kit(s) allocated`);
    } catch (error) {
      console.error('Failed to allocate photographer kits:', error);
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center gap-2 text-xs text-muted-foreground py-2">
        <Loader2 className="h-3 w-3 animate-spin" />
        Loading equipment profile...
      </div>
    );
  }

  if (!v2Data || v2Data.kits.length === 0) {
    return (
      <p className="text-xs text-muted-foreground py-2 italic">
        No equipment profile registered
      </p>
    );
  }

  const kitsWithItems = v2Data.kits.filter(k => k.items.some(i => i.name?.trim()));
  if (kitsWithItems.length === 0) {
    return (
      <p className="text-xs text-muted-foreground py-2 italic">
        No equipment profile registered
      </p>
    );
  }

  return (
    <div className="space-y-2 bg-muted/30 rounded-lg p-3">
      <p className="text-xs font-medium text-muted-foreground">Equipment Kits</p>
      {kitsWithItems.map(kit => {
        const cfg = CATEGORY_CONFIG.find(c => c.key === kit.category);
        const Icon = cfg?.icon;
        const isSelected = selectedKitIds.has(kit.id);
        return (
          <div
            key={kit.id}
            className={`space-y-1 ${selectable ? 'cursor-pointer' : ''}`}
            onClick={selectable ? () => toggleKit(kit.id) : undefined}
          >
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
              {selectable && (
                <Checkbox
                  checked={isSelected}
                  onCheckedChange={() => toggleKit(kit.id)}
                  onClick={e => e.stopPropagation()}
                  className="mr-1"
                />
              )}
              {Icon && <Icon className="h-3 w-3" />}
              <span className="font-medium">{kit.name}</span>
            </div>
            <div className={`flex flex-wrap gap-1 ${selectable ? 'pl-7' : ''}`}>
              {kit.items.filter(i => i.name?.trim()).map(item => (
                <Badge key={item.id} variant="outline" className="text-xs font-normal">
                  {item.name}{item.brand ? ` (${item.brand})` : ''}
                </Badge>
              ))}
            </div>
          </div>
        );
      })}
      {selectable && selectedKitIds.size > 0 && (
        <Button
          size="sm"
          className="w-full mt-2"
          onClick={handleAllocateSelected}
          disabled={allocateKits.isPending}
        >
          {allocateKits.isPending ? (
            <Loader2 className="h-4 w-4 mr-1 animate-spin" />
          ) : (
            <CheckCircle className="h-4 w-4 mr-1" />
          )}
          Allocate {selectedKitIds.size} Kit{selectedKitIds.size !== 1 ? 's' : ''}
        </Button>
      )}
    </div>
  );
}
