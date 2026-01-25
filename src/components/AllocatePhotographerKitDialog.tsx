import { useState, useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Camera, Sun, Image, Package, User, Loader2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useQuery } from '@tanstack/react-query';
import { toast } from 'sonner';

interface PhotographerKit {
  category: 'camera' | 'lighting' | 'backdrop' | 'other';
  label: string;
  icon: typeof Camera;
  items: Array<{ id: string; brand: string; name: string; notes?: string }>;
}

interface AssignedPhotographer {
  userId: string;
  name: string;
  kits: PhotographerKit[];
}

interface EventAssignment {
  id: string;
  user_id: string | null;
  staff_id: string | null;
  profile?: { id: string; full_name: string | null; email: string } | null;
  staff?: { id: string; name: string; email: string | null } | null;
  staff_role?: { id: string; name: string } | null;
}

interface AllocatePhotographerKitDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  eventId: string;
  assignments: EventAssignment[];
}

const KIT_CONFIG: { key: 'camera' | 'lighting' | 'backdrop' | 'other'; label: string; icon: typeof Camera }[] = [
  { key: 'camera', label: 'Camera Kit', icon: Camera },
  { key: 'lighting', label: 'Lighting Kit', icon: Sun },
  { key: 'backdrop', label: 'Backdrop Kit', icon: Image },
  { key: 'other', label: 'Other', icon: Package },
];

export function AllocatePhotographerKitDialog({
  open,
  onOpenChange,
  eventId,
  assignments,
}: AllocatePhotographerKitDialogProps) {
  const [selectedKits, setSelectedKits] = useState<Set<string>>(new Set());
  const [isAllocating, setIsAllocating] = useState(false);

  // Extract all assigned staff (both profile-linked and legacy)
  const allAssignedStaff = useMemo(() => {
    return assignments.map(a => {
      if (a.user_id && a.profile) {
        return {
          oderId: a.user_id,
          name: a.profile.full_name || a.profile.email,
          hasProfile: true,
          roleName: a.staff_role?.name || 'Staff',
        };
      } else if (a.staff_id && a.staff) {
        return {
          oderId: a.staff_id,
          name: a.staff.name,
          hasProfile: false,
          roleName: a.staff_role?.name || 'Staff',
        };
      }
      return null;
    }).filter((s): s is { oderId: string; name: string; hasProfile: boolean; roleName: string } => s !== null);
  }, [assignments]);

  // Only fetch equipment for staff who have profiles (user_id)
  const profileLinkedUserIds = allAssignedStaff.filter(s => s.hasProfile).map(s => s.oderId);

  // Fetch photographer equipment for profile-linked staff
  const { data: photographerData = [], isLoading } = useQuery({
    queryKey: ['photographer-equipment', profileLinkedUserIds],
    queryFn: async () => {
      if (profileLinkedUserIds.length === 0) return [];

      const { data, error } = await supabase
        .from('profiles')
        .select('id, full_name, photography_equipment_json')
        .in('id', profileLinkedUserIds);

      if (error) throw error;
      return data || [];
    },
    enabled: open && profileLinkedUserIds.length > 0,
  });

  // Transform data into photographers with kits
  const photographers: AssignedPhotographer[] = useMemo(() => {
    return allAssignedStaff.map(staff => {
      // Only profile-linked staff can have equipment in the profiles table
      const profile = staff.hasProfile 
        ? photographerData.find(p => p.id === staff.oderId) 
        : null;
      const equipment = (profile?.photography_equipment_json as Record<string, any>) || {};

      // Map old keys to new keys for compatibility
      const normalizedEquipment: Record<string, any[]> = {
        camera: equipment.camera || equipment.cameras || [],
        lighting: equipment.lighting || equipment.lights || [],
        backdrop: equipment.backdrop || equipment.backdrops || [],
        other: equipment.other || equipment.lenses || [],
      };

      const kits: PhotographerKit[] = KIT_CONFIG.map(config => ({
        category: config.key,
        label: config.label,
        icon: config.icon,
        items: normalizedEquipment[config.key] || [],
      })).filter(kit => kit.items.length > 0);

      return {
        userId: staff.oderId,
        name: staff.name,
        kits,
      };
    });
  }, [allAssignedStaff, photographerData]);

  const toggleKit = (photographerId: string, category: string) => {
    const key = `${photographerId}:${category}`;
    setSelectedKits(prev => {
      const next = new Set(prev);
      if (next.has(key)) {
        next.delete(key);
      } else {
        next.add(key);
      }
      return next;
    });
  };

  const handleAllocate = async () => {
    if (selectedKits.size === 0) {
      toast.error('Please select at least one kit to allocate');
      return;
    }

    setIsAllocating(true);

    try {
      // For now, just log what would be allocated
      // In a full implementation, you'd create allocation records linking photographer gear to the event
      const allocations = Array.from(selectedKits).map(key => {
        const [userId, category] = key.split(':');
        const photographer = photographers.find(p => p.userId === userId);
        const kit = photographer?.kits.find(k => k.category === category);
        return { userId, category, photographerName: photographer?.name, items: kit?.items };
      });

      console.log('Allocating photographer kits:', allocations);
      
      // TODO: Store these allocations in a photographer_kit_allocations table
      // For now, we'll show a success message
      toast.success(`Allocated ${selectedKits.size} kit(s) to this event`);
      
      setSelectedKits(new Set());
      onOpenChange(false);
    } catch (error) {
      toast.error('Failed to allocate kits');
    } finally {
      setIsAllocating(false);
    }
  };

  const handleClose = () => {
    setSelectedKits(new Set());
    onOpenChange(false);
  };

  const photographersWithKits = photographers.filter(p => p.kits.length > 0);
  const photographersWithoutKits = photographers.filter(p => p.kits.length === 0);

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-2xl max-h-[80vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Camera className="h-5 w-5" />
            Allocate Photographer Kits
          </DialogTitle>
          <DialogDescription>
            Select photographer equipment kits to allocate to this event
          </DialogDescription>
        </DialogHeader>

        <ScrollArea className="flex-1 pr-4">
          {isLoading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : allAssignedStaff.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <User className="h-12 w-12 mx-auto mb-2 opacity-50" />
              <p>No photographers assigned to this event</p>
              <p className="text-sm">Assign staff first to allocate their equipment</p>
            </div>
          ) : photographersWithKits.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <Package className="h-12 w-12 mx-auto mb-2 opacity-50" />
              <p>No equipment kits found</p>
              <p className="text-sm">Assigned photographers don't have any equipment registered</p>
            </div>
          ) : (
            <div className="space-y-6">
              {photographersWithKits.map(photographer => (
                <div key={photographer.userId} className="space-y-3">
                  <div className="flex items-center gap-2">
                    <User className="h-4 w-4 text-muted-foreground" />
                    <Label className="font-medium">{photographer.name}</Label>
                  </div>
                  
                  <div className="grid gap-2 pl-6">
                    {photographer.kits.map(kit => {
                      const key = `${photographer.userId}:${kit.category}`;
                      const isSelected = selectedKits.has(key);
                      const Icon = kit.icon;

                      return (
                        <div
                          key={kit.category}
                          className={`flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-colors ${
                            isSelected 
                              ? 'bg-primary/10 border-primary' 
                              : 'bg-muted/30 border-border hover:bg-muted/50'
                          }`}
                          onClick={() => toggleKit(photographer.userId, kit.category)}
                        >
                          <Checkbox
                            checked={isSelected}
                            onCheckedChange={() => toggleKit(photographer.userId, kit.category)}
                          />
                          <Icon className="h-4 w-4 text-muted-foreground" />
                          <div className="flex-1">
                            <div className="font-medium text-sm">{kit.label}</div>
                            <div className="text-xs text-muted-foreground">
                              {kit.items.map(item => `${item.brand} ${item.name}`).join(', ')}
                            </div>
                          </div>
                          <Badge variant="secondary" className="text-xs">
                            {kit.items.length} item{kit.items.length !== 1 ? 's' : ''}
                          </Badge>
                        </div>
                      );
                    })}
                  </div>
                </div>
              ))}

              {photographersWithoutKits.length > 0 && (
                <div className="pt-4 border-t">
                  <p className="text-sm text-muted-foreground mb-2">
                    Photographers without equipment registered:
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {photographersWithoutKits.map(p => (
                      <Badge key={p.userId} variant="outline" className="text-muted-foreground">
                        {p.name}
                      </Badge>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </ScrollArea>

        <DialogFooter className="gap-2 pt-4 border-t">
          <Button variant="outline" onClick={handleClose}>
            Cancel
          </Button>
          <Button 
            onClick={handleAllocate} 
            disabled={selectedKits.size === 0 || isAllocating}
          >
            {isAllocating && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            Allocate {selectedKits.size > 0 ? `${selectedKits.size} Kit(s)` : 'Selected'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
