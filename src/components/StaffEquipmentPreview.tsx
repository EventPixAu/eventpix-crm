/**
 * StaffEquipmentPreview - Shows a compact read-only view of a staff member's
 * photography equipment profile, for use in allocation dialogs.
 */

import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Camera, Lightbulb, Image, Aperture, Loader2 } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import type { PhotographyEquipment } from './PhotographyEquipmentEditor';

interface StaffEquipmentPreviewProps {
  userId: string;
}

const CATEGORY_CONFIG = [
  { key: 'camera' as const, label: 'Camera Kit', icon: Camera },
  { key: 'lighting' as const, label: 'Lighting', icon: Lightbulb },
  { key: 'backdrop' as const, label: 'Backdrops', icon: Image },
  { key: 'other' as const, label: 'Other', icon: Aperture },
];

export function StaffEquipmentPreview({ userId }: StaffEquipmentPreviewProps) {
  const { data: equipment, isLoading } = useQuery({
    queryKey: ['staff-equipment-profile', userId],
    queryFn: async () => {
      // Try profiles first
      const { data: profile } = await supabase
        .from('profiles')
        .select('photography_equipment_json')
        .eq('id', userId)
        .maybeSingle();

      if (profile?.photography_equipment_json) {
        return profile.photography_equipment_json as unknown as PhotographyEquipment;
      }

      // Fallback: check staff table by user_id
      const { data: staff } = await supabase
        .from('staff')
        .select('photography_equipment_json')
        .eq('user_id', userId)
        .maybeSingle();

      return (staff?.photography_equipment_json as unknown as PhotographyEquipment) || null;
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

  if (!equipment) {
    return (
      <p className="text-xs text-muted-foreground py-2 italic">
        No equipment profile registered
      </p>
    );
  }

  // Normalize old key formats
  const normalized: PhotographyEquipment = {
    camera: equipment.camera || (equipment as any).cameras || [],
    lighting: equipment.lighting || (equipment as any).lights || [],
    backdrop: equipment.backdrop || (equipment as any).backdrops || [],
    other: equipment.other || (equipment as any).lenses || [],
  };

  const hasAny = CATEGORY_CONFIG.some(c => (normalized[c.key]?.length || 0) > 0);

  if (!hasAny) {
    return (
      <p className="text-xs text-muted-foreground py-2 italic">
        No equipment profile registered
      </p>
    );
  }

  return (
    <div className="space-y-2 bg-muted/30 rounded-lg p-3">
      <p className="text-xs font-medium text-muted-foreground">Equipment Profile</p>
      {CATEGORY_CONFIG.map(({ key, label, icon: Icon }) => {
        const items = normalized[key] || [];
        if (items.length === 0) return null;
        return (
          <div key={key} className="space-y-1">
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <Icon className="h-3 w-3" />
              <span>{label}</span>
            </div>
            <div className="flex flex-wrap gap-1">
              {items.map((item) => (
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
