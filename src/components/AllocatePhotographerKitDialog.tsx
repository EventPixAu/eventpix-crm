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
import { Camera, Package, User, Loader2, Smartphone, Laptop } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useQuery } from '@tanstack/react-query';
import { toast } from 'sonner';
import { useAllocatePhotographerKits } from '@/hooks/useEquipmentAllocations';
import { type StoredEquipment, migrateToV2, CATEGORY_CONFIG } from './PhotographyEquipmentEditor';
import { AssignmentPhoneKit } from './AssignmentPhoneKit';
import { phoneKitDetails, phoneUploadAllocation, requestMissingPhoneKitDetails } from '@/lib/phoneUploadKit';
import { laptopAllocation, sendLaptopReminders } from '@/lib/laptopReminder';

interface PhotographerKit {
  kitId: string;
  category: 'camera' | 'lighting' | 'audio' | 'backdrop' | 'other' | 'phone' | 'computer';
  label: string;
  icon: typeof Camera;
  items: Array<{ id: string; brand: string; name: string; notes?: string }>;
}

interface AssignedPhotographer {
  userId: string | null;
  displayId: string;
  name: string;
  kits: PhotographerKit[];
  assignmentId?: string;
  staffId?: string | null;
  phoneSummary: string;
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
    // Use a Set to track all IDs (user_id and staff_id) we've already processed
    const seenIds = new Set<string>();
    const result: { ownerId: string; profileUserId: string | null; name: string; hasProfile: boolean; roleName: string }[] = [];
    
    for (const a of assignments) {
      if (a.user_id && a.profile) {
        if (seenIds.has(a.user_id)) continue;
        seenIds.add(a.user_id);
        // Also mark the staff_id if present to prevent duplicate from legacy record
        if (a.staff_id) seenIds.add(a.staff_id);
        result.push({
          ownerId: a.user_id,
          profileUserId: a.user_id,
          name: a.profile.full_name || a.profile.email,
          hasProfile: true,
          roleName: a.staff_role?.name || 'Staff',
        });
      } else if (a.staff_id && a.staff) {
        if (seenIds.has(a.staff_id)) continue;
        seenIds.add(a.staff_id);
        result.push({
          ownerId: a.staff_id,
          profileUserId: null,
          name: a.staff.name,
          hasProfile: false,
          roleName: a.staff_role?.name || 'Staff',
        });
      }
    }
    return result;
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
        
        const phone = phoneKitDetails(profileEquip).phone || phoneKitDetails(staffEquip).phone;
        return {
          ...p,
          photography_equipment_json: { ...(profileHasEquip ? profileEquip : staffEquip), phone },
        };
      });
    },
    enabled: open && allUserIds.length > 0,
  });

  const isLoading = isLoadingEquipment;

  // Transform data into photographers with kits
  const photographers: AssignedPhotographer[] = useMemo(() => {
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
      
      const details = phoneKitDetails(equipment);
      kits.push({ ...phoneUploadAllocation(), icon: Smartphone });
      kits.push({ ...laptopAllocation(), icon: Laptop });
      const assignment = assignments.find(a => (userIdToLookup && a.user_id === userIdToLookup) || a.staff_id === staff.ownerId);

      return {
        userId: userIdToLookup, // Use resolved profile user_id for FK constraint
        displayId: staff.ownerId, // Keep original ID for UI keys
        name: staff.name,
        kits,
        assignmentId: assignment?.id,
        staffId: assignment?.staff_id,
        phoneSummary: details.ready
          ? `${details.phone?.model} · ${details.phone?.usb} · ${details.phone?.uploadCable}`
          : `Missing: ${details.missing.join(', ')}`,
      };
    });
  }, [allAssignedStaff, photographerData, staffUserLinks, assignments]);

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
    if (selectedKits.size === 0 || isAllocating) {
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

      const requestResults = await requestMissingPhoneKitDetails(
        photographers.flatMap(p => p.userId && p.assignmentId ? [{
          userId: p.userId, assignmentId: p.assignmentId,
          phoneSelected: selectedKits.has(`${p.displayId}:phone-upload`),
        }] : []),
        async userId => {
          // Read current details, not the cached profile shown when the window opened.
          const { data, error } = await supabase.from('profiles')
            .select('photography_equipment_json').eq('id', userId).maybeSingle();
          if (error) throw error;
          if (!data) throw new Error('Team profile unavailable');
          return data.photography_equipment_json;
        },
        async assignmentId => {
          const { data, error } = await supabase.functions.invoke('send-notification', {
            body: { type: 'phone_kit_request', event_id: eventId, assignment_id: assignmentId },
          });
          if (error) throw error;
          if (!data?.success) throw new Error('Phone details request was not sent');
        },
      );
      const failedRequests = requestResults.filter(r => r.status === 'rejected').length;
      const sentRequests = requestResults.filter(r => r.status === 'fulfilled' && r.value).length;
      if (sentRequests) toast.success(`Phone-kit details requested from ${sentRequests} team member${sentRequests === 1 ? '' : 's'}`);
      if (failedRequests) toast.error('Equipment allocated, but some phone-details requests failed. Use Request phone-kit details to retry.');

      const laptopResults = await sendLaptopReminders(
        photographers.flatMap(p => p.userId && p.assignmentId ? [{
          userId: p.userId, assignmentId: p.assignmentId,
          laptopSelected: selectedKits.has(`${p.displayId}:bring-laptop`),
        }] : []),
        async assignmentId => {
          const { data, error } = await supabase.functions.invoke('send-notification', {
            body: { type: 'laptop_reminder', event_id: eventId, assignment_id: assignmentId },
          });
          if (error) throw error;
          if (!data?.success) throw new Error('Laptop reminder was not sent');
        },
      );
      if (laptopResults.some(r => r.status === 'fulfilled')) toast.success('Bring-laptop reminder sent');
      if (laptopResults.some(r => r.status === 'rejected')) toast.error('Laptop allocated, but the reminder could not be sent.');
      
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

        <ScrollArea className="flex-1 min-h-0 pr-4 [&>[data-radix-scroll-area-viewport]>div]:!block">
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
                      const key = `${photographer.displayId}:${kit.kitId}`;
                      const isSelected = selectedKits.has(key);
                      const Icon = kit.icon;

                      return (
                        <div key={kit.kitId} className="min-w-0">
                        <div
                          key={kit.kitId}
                          className={`flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-colors ${
                            isSelected 
                              ? 'bg-primary/10 border-primary' 
                              : 'bg-muted/30 border-border hover:bg-muted/50'
                          }`}
                          onClick={() => toggleKit(photographer.displayId, kit.kitId)}
                        >
                          <Checkbox
                            aria-label={`${photographer.name}: ${kit.label}`}
                            checked={isSelected}
                            onCheckedChange={() => toggleKit(photographer.displayId, kit.kitId)}
                            onClick={(e) => e.stopPropagation()}
                          />
                          <Icon className="h-4 w-4 text-muted-foreground" />
                          <div className="flex-1 min-w-0 break-words">
                            <div className="font-medium text-sm">{kit.label}</div>
                            <div className="text-xs text-muted-foreground">
                              {kit.kitId === 'bring-laptop' ? 'Laptop and charger' : kit.category === 'phone' ? photographer.phoneSummary : kit.items.map(item => `${item.brand ? item.brand + ' ' : ''}${item.name}`).join(', ')}
                            </div>
                          </div>
                          <Badge variant="secondary" className="text-xs shrink-0">
                            {kit.items.length} item{kit.items.length !== 1 ? 's' : ''}
                          </Badge>
                        </div>
                        {kit.category === 'phone' && <AssignmentPhoneKit
                          eventId={eventId} userId={photographer.userId} staffId={photographer.staffId}
                          assignmentId={photographer.assignmentId} required canRequest
                        />}
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
