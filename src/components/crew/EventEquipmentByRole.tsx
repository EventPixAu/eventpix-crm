/**
 * EventEquipmentByRole - Display equipment grouped by assignment role
 * 
 * Shows equipment split by:
 * - EventPix (company equipment) - individual items listed in detail
 * - Photographer/Staff - only kit categories shown (Camera Kit, Lighting Kit, Backdrop Kit, Other)
 */
import { useMemo } from 'react';
import { Package, CheckCircle, AlertCircle, User, Camera, Lightbulb, Image, MoreHorizontal } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { useEventAllocations, useUpdateAllocationStatus } from '@/hooks/useEquipmentAllocations';
import { useEventAssignments } from '@/hooks/useEvents';
import { useStaffRoles } from '@/hooks/useLookups';
import { useAuth } from '@/lib/auth';
import { cn } from '@/lib/utils';

interface EventEquipmentByRoleProps {
  eventId: string;
  showActions?: boolean;
}

interface EquipmentItem {
  id: string;
  name: string;
  brand: string | null;
  category: string;
  status: string;
  isCompanyOwned: boolean;
}

interface GroupedEquipment {
  roleName: string;
  roleKey: string;
  userName: string | null;
  isCurrentUser: boolean;
  isCompanyEquipment: boolean;
  items: EquipmentItem[];
}

// Kit category definitions for photographer gear
const KIT_CATEGORIES = [
  { key: 'camera', label: 'Camera Kit', icon: Camera, keywords: ['camera', 'lens', 'body'] },
  { key: 'lighting', label: 'Lighting Kit', icon: Lightbulb, keywords: ['light', 'flash', 'strobe', 'softbox', 'reflector'] },
  { key: 'backdrop', label: 'Backdrop Kit', icon: Image, keywords: ['backdrop', 'background', 'stand', 'muslin'] },
  { key: 'other', label: 'Other Equipment', icon: MoreHorizontal, keywords: [] },
];

function categorizeToKit(category: string, name: string): string {
  const lowerCategory = category.toLowerCase();
  const lowerName = name.toLowerCase();
  
  for (const kit of KIT_CATEGORIES) {
    if (kit.key === 'other') continue;
    if (kit.keywords.some(kw => lowerCategory.includes(kw) || lowerName.includes(kw))) {
      return kit.key;
    }
  }
  return 'other';
}

export function EventEquipmentByRole({ eventId, showActions = true }: EventEquipmentByRoleProps) {
  const { user } = useAuth();
  const { data: allocations = [], isLoading } = useEventAllocations(eventId);
  const { data: assignments = [] } = useEventAssignments(eventId);
  const { data: staffRoles = [] } = useStaffRoles();
  const updateStatus = useUpdateAllocationStatus();

  // Group equipment by role
  const groupedEquipment = useMemo((): GroupedEquipment[] => {
    if (!allocations.length) return [];

    const groups: Record<string, GroupedEquipment> = {};

    allocations.forEach((alloc) => {
      // Defensive: allocation rows can exist with a missing equipment_item (deleted item or restricted join)
      if (!alloc.equipment_item) return;

      // Determine if this is company-owned equipment
      const isCompanyOwned = !alloc.equipment_item.owner_user_id;
      
      // Find assignment for this allocation's user
      const assignment = assignments.find((a) => a.user_id === alloc.user_id);
      const staffRole = assignment?.staff_role_id
        ? staffRoles.find((r) => r.id === assignment.staff_role_id)
        : null;

      // Determine role name
      let roleName = 'Unassigned';
      let roleKey = 'unassigned';
      let userName: string | null = null;
      let isCompanyEquipment = false;

      if (alloc.user_id) {
        userName = alloc.profile?.full_name || null;
        
        if (staffRole?.name) {
          roleName = staffRole.name;
          roleKey = staffRole.name.toLowerCase().replace(/\s+/g, '_');
        } else if (assignment?.role_on_event) {
          roleName = assignment.role_on_event;
          roleKey = assignment.role_on_event.toLowerCase().replace(/\s+/g, '_');
        } else {
          roleName = 'Staff';
          roleKey = 'staff';
        }
      } else {
        // No user assigned - this is company (EventPix) equipment
        roleName = 'EventPix (Company)';
        roleKey = 'eventpix';
        isCompanyEquipment = true;
      }

      if (!groups[roleKey]) {
        groups[roleKey] = {
          roleName,
          roleKey,
          userName,
          isCurrentUser: alloc.user_id === user?.id,
          isCompanyEquipment,
          items: [],
        };
      }

      groups[roleKey].items.push({
        id: alloc.id,
        name: alloc.equipment_item.name,
        brand: alloc.equipment_item.brand,
        category: (alloc.equipment_item.category || 'other').trim() || 'other',
        status: alloc.status,
        isCompanyOwned,
      });
    });

    // Sort: EventPix first, then current user, then alphabetically
    return Object.values(groups).sort((a, b) => {
      if (a.isCompanyEquipment && !b.isCompanyEquipment) return -1;
      if (!a.isCompanyEquipment && b.isCompanyEquipment) return 1;
      if (a.isCurrentUser && !b.isCurrentUser) return -1;
      if (!a.isCurrentUser && b.isCurrentUser) return 1;
      return a.roleName.localeCompare(b.roleName);
    });
  }, [allocations, assignments, staffRoles, user?.id]);

  const handleMarkPickedUp = async (id: string) => {
    await updateStatus.mutateAsync({
      id,
      status: 'picked_up',
      eventId,
    });
  };

  if (isLoading) {
    return (
      <Card>
        <CardContent className="py-6">
          <div className="flex items-center justify-center text-muted-foreground">
            Loading equipment...
          </div>
        </CardContent>
      </Card>
    );
  }

  if (groupedEquipment.length === 0) {
    return null;
  }

  const totalItems = allocations.length;
  const pickedUpItems = allocations.filter((a) => a.status === 'picked_up').length;
  const allPickedUp = totalItems > 0 && pickedUpItems === totalItems;

  // Render individual items (for EventPix equipment)
  const renderIndividualItems = (items: EquipmentItem[], isCurrentUser: boolean) => (
    <div className="space-y-1 ml-6">
      {items.map((item) => (
        <div
          key={item.id}
          className={cn(
            'flex items-center justify-between p-2 rounded-lg',
            isCurrentUser ? 'bg-primary/5' : 'bg-muted/50'
          )}
        >
          <div className="flex items-center gap-2 min-w-0">
            {item.status === 'picked_up' ? (
              <CheckCircle className="h-4 w-4 text-green-500 shrink-0" />
            ) : (
              <AlertCircle className="h-4 w-4 text-muted-foreground shrink-0" />
            )}
            <span className="text-sm truncate">{item.name}</span>
            {item.brand && (
              <span className="text-xs text-muted-foreground hidden sm:inline">
                ({item.brand})
              </span>
            )}
          </div>
          
          {showActions && isCurrentUser && item.status === 'allocated' && (
            <Button
              size="sm"
              variant="outline"
              onClick={() => handleMarkPickedUp(item.id)}
              disabled={updateStatus.isPending}
              className="shrink-0 ml-2"
            >
              Pick Up
            </Button>
          )}
          {item.status === 'picked_up' && (
            <Badge variant="secondary" className="shrink-0 ml-2">
              Ready
            </Badge>
          )}
        </div>
      ))}
    </div>
  );

  // Render kit summary (for photographer-owned equipment)
  const renderKitSummary = (items: EquipmentItem[], isCurrentUser: boolean) => {
    // Group items by kit category
    const kitGroups: Record<string, EquipmentItem[]> = {};
    items.forEach((item) => {
      const kitKey = categorizeToKit(item.category, item.name);
      if (!kitGroups[kitKey]) kitGroups[kitKey] = [];
      kitGroups[kitKey].push(item);
    });

    return (
      <div className="space-y-1 ml-6">
        {KIT_CATEGORIES.map((kit) => {
          const kitItems = kitGroups[kit.key];
          if (!kitItems?.length) return null;

          const allReady = kitItems.every((i) => i.status === 'picked_up');
          const Icon = kit.icon;

          return (
            <div
              key={kit.key}
              className={cn(
                'flex items-center justify-between p-2 rounded-lg',
                isCurrentUser ? 'bg-primary/5' : 'bg-muted/50'
              )}
            >
              <div className="flex items-center gap-2 min-w-0">
                {allReady ? (
                  <CheckCircle className="h-4 w-4 text-green-500 shrink-0" />
                ) : (
                  <Icon className="h-4 w-4 text-muted-foreground shrink-0" />
                )}
                <span className="text-sm font-medium">{kit.label}</span>
                <span className="text-xs text-muted-foreground">
                  ({kitItems.length} {kitItems.length === 1 ? 'item' : 'items'})
                </span>
              </div>
              {allReady && (
                <Badge variant="secondary" className="shrink-0 ml-2">
                  Ready
                </Badge>
              )}
            </div>
          );
        })}
      </div>
    );
  };

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Package className="h-4 w-4" />
            Equipment Requirements
          </div>
          <Badge variant={allPickedUp ? 'default' : 'secondary'}>
            {pickedUpItems}/{totalItems}
            {allPickedUp && <CheckCircle className="h-3 w-3 ml-1" />}
          </Badge>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {groupedEquipment.map((group) => {
          // Separate company-owned vs photographer-owned items
          const companyItems = group.items.filter((i) => i.isCompanyOwned);
          const photographerItems = group.items.filter((i) => !i.isCompanyOwned);

          return (
            <div key={group.roleKey} className="space-y-2">
              {/* Role header */}
              <div className="flex items-center gap-2">
                <User className="h-4 w-4 text-muted-foreground" />
                <span className="text-sm font-medium">
                  {group.roleName}
                  {group.userName && !group.isCompanyEquipment && (
                    <span className="text-muted-foreground font-normal">
                      {' '}– {group.userName}
                      {group.isCurrentUser && <span className="text-primary ml-1">(You)</span>}
                    </span>
                  )}
                </span>
              </div>

              {/* Company-owned equipment - show individual items */}
              {companyItems.length > 0 && (
                <>
                  {photographerItems.length > 0 && (
                    <div className="ml-6 text-xs text-muted-foreground font-medium">EventPix Gear</div>
                  )}
                  {renderIndividualItems(companyItems, group.isCurrentUser)}
                </>
              )}

              {/* Photographer-owned equipment - show kit summary */}
              {photographerItems.length > 0 && (
                <>
                  {companyItems.length > 0 && (
                    <div className="ml-6 text-xs text-muted-foreground font-medium mt-2">Personal Gear (Kits)</div>
                  )}
                  {renderKitSummary(photographerItems, group.isCurrentUser)}
                </>
              )}
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
}
