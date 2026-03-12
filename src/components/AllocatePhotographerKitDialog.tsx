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
import { useAllocatePhotographerKits } from '@/hooks/useEquipmentAllocations';
import { type StoredEquipment, migrateToV2, CATEGORY_CONFIG } from './PhotographyEquipmentEditor';

interface PhotographerKit {
  kitId: string;
  category: 'camera' | 'lighting' | 'backdrop' | 'other';
  label: string;
  icon: typeof Camera;
  items: Array<{ id: string; brand: string; name: string; notes?: string }>;
}

interface AssignedPhotographer {
  userId: string | null;
  displayId: string;
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
  const allocateKits = useAllocatePhotographerKits();

  // Extract all assigned staff (both profile-linked and legacy)
  const allAssignedStaff = useMemo(() => {
    return assignments.map(a => {
      if (a.user_id && a.profile) {
        return {
          ownerId: a.user_id,
          profileUserId: a.user_id,
          name: a.profile.full_name || a.profile.email,
          hasProfile: true,
          roleName: a.staff_role?.name || 'Staff',
        };
      } else if (a.staff_id && a.staff) {
        return {
          ownerId: a.staff_id,
          profileUserId: null,
          name: a.staff.name,
          hasProfile: false,
          roleName: a.staff_role?.name || 'Staff',
        };
      }
      return null;
    }).filter((s): s is { ownerId: string; profileUserId: string | null; name: string; hasProfile: boolean; roleName: string } => s !== null);
  }, [assignments]);

  // Collect all staff IDs to check which ones have linked profiles
  const allStaffIds = allAssignedStaff.filter(s => !s.hasProfile).map(s => s.ownerId);
  const directUserIds = allAssignedStaff.filter(s => s.hasProfile).map(s => s.ownerId);

  // Query to get user_ids for staff records that might be linked
  const { data: staffUserLinks } = useQuery({
    queryKey: ['staff-user-links', allStaffIds],
    queryFn: async () => {
      if (allStaffIds.length === 0) return [];
      const { data, error } = await supabase
        .from('staff')
        .select('id, user_id')
        .in('id', allStaffIds)
        .not('user_id', 'is', null);
      if (error) throw error;
      return data || [];
    },
    enabled: open && allStaffIds.length > 0,
  });

  // Combine direct user_ids with user_ids from linked staff records
  const allUserIds = useMemo(() => {
    const linkedUserIds = (staffUserLinks || []).map(s => s.user_id).filter(Boolean);
    return [...new Set([...directUserIds, ...linkedUserIds])];
  }, [directUserIds, staffUserLinks]);

  // Fetch photographer equipment
  const { data: photographerData = [], isLoading: isLoadingEquipment } = useQuery({
    queryKey: ['photographer-equipment', allUserIds],
    queryFn: async () => {
      if (allUserIds.length === 0) return [];

      // Get profiles with their equipment
      const { data: profiles, error: profilesError } = await supabase
        .from('profiles')
        .select('id, full_name, photography_equipment_json')
        .in('id', allUserIds);

      if (profilesError) throw profilesError;

      // Also get staff records that are linked to these profiles (may have equipment there)
      const { data: staffRecords, error: staffError } = await supabase
        .from('staff')
        .select('user_id, photography_equipment_json')
        .in('user_id', allUserIds);

      if (staffError) throw staffError;

      // Merge: prefer staff equipment if profile equipment is empty
      const staffEquipmentMap = (staffRecords || []).reduce((acc, s) => {
        if (s.user_id) acc[s.user_id] = s.photography_equipment_json;
        return acc;
      }, {} as Record<string, any>);

      return (profiles || []).map(p => {
        const profileEquip = p.photography_equipment_json as Record<string, any> || {};
        const staffEquip = staffEquipmentMap[p.id] || {};
        
        // Check if profile equipment is essentially empty
        const profileHasEquip = Object.values(profileEquip).some(
          arr => Array.isArray(arr) && arr.length > 0
        );
        
        return {
          ...p,
          photography_equipment_json: profileHasEquip ? profileEquip : staffEquip,
        };
      });
    },
    enabled: open && allUserIds.length > 0,
  });

  const isLoading = isLoadingEquipment;

  // Transform data into photographers with kits
  const photographers: AssignedPhotographer[] = useMemo(() => {
    console.log('[AllocateKit] allAssignedStaff:', allAssignedStaff);
    console.log('[AllocateKit] photographerData:', photographerData);
    console.log('[AllocateKit] staffUserLinks:', staffUserLinks);
    
    return allAssignedStaff.map(staff => {
      // For staff-based assignments, check if staff record has a linked user_id
      let userIdToLookup = staff.profileUserId;
      if (!staff.hasProfile) {
        const linkedStaff = (staffUserLinks || []).find(s => s.id === staff.ownerId);
        if (linkedStaff?.user_id) {
          userIdToLookup = linkedStaff.user_id;
        }
      }

      const profile = staff.hasProfile 
        ? photographerData.find(p => p.id === staff.ownerId) 
        : photographerData.find(p => p.id === userIdToLookup);
      const equipment = profile?.photography_equipment_json || {};
      
      console.log('[AllocateKit] Processing staff:', staff.name, 'hasProfile:', staff.hasProfile, 'equipment:', equipment);

      // Migrate to v2 format to support named kits
      const v2 = migrateToV2(equipment as StoredEquipment);
      
      const kits: PhotographerKit[] = v2.kits
        .filter(kit => kit.items.some(i => i.name?.trim()))
        .map(kit => {
          const cfg = CATEGORY_CONFIG.find(c => c.key === kit.category);
          return {
            kitId: kit.id,
            category: kit.category,
            label: kit.name,
            icon: cfg?.icon || Package,
            items: kit.items.filter(i => i.name?.trim()),
          };
        });
      
      console.log('[AllocateKit] Staff:', staff.name, 'kits:', kits.length);

      return {
        userId: userIdToLookup, // Use resolved profile user_id for FK constraint
        displayId: staff.ownerId, // Keep original ID for UI keys
        name: staff.name,
        kits,
      };
    });
  }, [allAssignedStaff, photographerData, staffUserLinks]);

  const toggleKit = (photographerId: string, kitId: string) => {
    const key = `${photographerId}:${kitId}`;
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
      return;
    }

    setIsAllocating(true);

    try {
      const kitsToAllocate = Array.from(selectedKits).map(key => {
        const [displayId, kitId] = key.split(':');
        const photographer = photographers.find(p => p.displayId === displayId);
        const kit = photographer?.kits.find(k => k.kitId === kitId);
        
        if (!photographer?.userId) {
          console.warn('[AllocateKit] Skipping kit - no profile user_id for:', photographer?.name);
          return null;
        }
        
        return { 
          userId: photographer.userId,
          category: kit?.category || 'other', 
          items: kit?.items || [] 
        };
      }).filter(Boolean) as Array<{ userId: string; category: string; items: any[] }>;

      if (kitsToAllocate.length === 0) {
        toast.error('Unable to allocate - selected photographers must have linked accounts');
        return;
      }

      await allocateKits.mutateAsync({
        eventId,
        kits: kitsToAllocate,
      });
      
      setSelectedKits(new Set());
      onOpenChange(false);
    } catch (error) {
      console.error('Failed to allocate kits:', error);
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
                <div key={photographer.displayId} className="space-y-3">
                  <div className="flex items-center gap-2">
                    <User className="h-4 w-4 text-muted-foreground" />
                    <Label className="font-medium">{photographer.name}</Label>
                  </div>
                  
                  <div className="grid gap-2 pl-6">
                    {photographer.kits.map(kit => {
                      const key = `${photographer.displayId}:${kit.category}`;
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
                          onClick={() => toggleKit(photographer.displayId, kit.category)}
                        >
                          <Checkbox
                            checked={isSelected}
                            onCheckedChange={() => toggleKit(photographer.displayId, kit.category)}
                            onClick={(e) => e.stopPropagation()}
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
                      <Badge key={p.displayId} variant="outline" className="text-muted-foreground">
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
