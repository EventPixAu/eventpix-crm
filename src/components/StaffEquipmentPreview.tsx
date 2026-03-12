/**
 * StaffEquipmentPreview - Shows a compact read-only view of a staff member's
 * photography equipment kits, for use in allocation dialogs.
 */

import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Loader2 } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import {
  type StoredEquipment,
  type PhotographyEquipmentV2,
  migrateToV2,
  CATEGORY_CONFIG,
} from './PhotographyEquipmentEditor';

interface StaffEquipmentPreviewProps {
  userId: string;
}

export function StaffEquipmentPreview({ userId }: StaffEquipmentPreviewProps) {
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

  const hasItems = v2Data.kits.some(k => k.items.length > 0);
  if (!hasItems) {
    return (
      <p className="text-xs text-muted-foreground py-2 italic">
        No equipment profile registered
      </p>
    );
  }

  return (
    <div className="space-y-2 bg-muted/30 rounded-lg p-3">
      <p className="text-xs font-medium text-muted-foreground">Equipment Kits</p>
      {v2Data.kits.map(kit => {
        if (kit.items.length === 0) return null;
        const cfg = CATEGORY_CONFIG.find(c => c.key === kit.category);
        const Icon = cfg?.icon;
        return (
          <div key={kit.id} className="space-y-1">
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
              {Icon && <Icon className="h-3 w-3" />}
              <span className="font-medium">{kit.name}</span>
            </div>
            <div className="flex flex-wrap gap-1">
              {kit.items.map(item => (
                <Badge key={item.id} variant="outline" className="text-xs font-normal">
                  {item.name}{item.brand ? ` (${item.brand})` : ''}
                </Badge>
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}
