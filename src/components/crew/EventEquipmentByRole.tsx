/**
 * EventEquipmentByRole - Display equipment grouped by assignment role
 * 
 * Shows equipment split by:
 * - Photographer
 * - Assistant
 * - EventPix (company equipment)
 * - Unassigned
 */
import { useMemo } from 'react';
import { Package, CheckCircle, AlertCircle, User } from 'lucide-react';
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

interface GroupedEquipment {
  roleName: string;
  roleKey: string;
  userName: string | null;
  isCurrentUser: boolean;
  items: {
    id: string;
    name: string;
    brand: string | null;
    category: string;
    status: string;
  }[];
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
      // Find assignment for this allocation's user
      const assignment = assignments.find((a) => a.user_id === alloc.user_id);
      const staffRole = assignment?.staff_role_id
        ? staffRoles.find((r) => r.id === assignment.staff_role_id)
        : null;

      // Determine role name
      let roleName = 'Unassigned';
      let roleKey = 'unassigned';
      let userName: string | null = null;

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
      }

      if (!groups[roleKey]) {
        groups[roleKey] = {
          roleName,
          roleKey,
          userName,
          isCurrentUser: alloc.user_id === user?.id,
          items: [],
        };
      }

      groups[roleKey].items.push({
        id: alloc.id,
        name: alloc.equipment_item.name,
        brand: alloc.equipment_item.brand,
        category: alloc.equipment_item.category,
        status: alloc.status,
      });
    });

    // Sort: current user first, then alphabetically
    return Object.values(groups).sort((a, b) => {
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

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Package className="h-4 w-4" />
            Equipment by Role
          </div>
          <Badge variant={allPickedUp ? 'default' : 'secondary'}>
            {pickedUpItems}/{totalItems}
            {allPickedUp && <CheckCircle className="h-3 w-3 ml-1" />}
          </Badge>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {groupedEquipment.map((group) => (
          <div key={group.roleKey} className="space-y-2">
            {/* Role header */}
            <div className="flex items-center gap-2">
              <User className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm font-medium">
                {group.roleName}
                {group.userName && group.roleName !== 'EventPix (Company)' && (
                  <span className="text-muted-foreground font-normal">
                    {' '}– {group.userName}
                    {group.isCurrentUser && <span className="text-primary ml-1">(You)</span>}
                  </span>
                )}
              </span>
            </div>

            {/* Equipment items */}
            <div className="space-y-1 ml-6">
              {group.items.map((item) => (
                <div
                  key={item.id}
                  className={cn(
                    'flex items-center justify-between p-2 rounded-lg',
                    group.isCurrentUser ? 'bg-primary/5' : 'bg-muted/50'
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
                  
                  {showActions && group.isCurrentUser && item.status === 'allocated' && (
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
          </div>
        ))}
      </CardContent>
    </Card>
  );
}
