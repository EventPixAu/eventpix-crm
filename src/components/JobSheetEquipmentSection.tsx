import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Package, CheckCircle, AlertCircle } from 'lucide-react';
import { useEventAllocations, useUpdateAllocationStatus, ALLOCATION_STATUS_CONFIG, AllocationStatus } from '@/hooks/useEquipmentAllocations';
import { useAuth } from '@/lib/auth';

interface JobSheetEquipmentSectionProps {
  eventId: string;
}

export function JobSheetEquipmentSection({ eventId }: JobSheetEquipmentSectionProps) {
  const { user } = useAuth();
  const { data: allocations, isLoading } = useEventAllocations(eventId);
  const updateStatus = useUpdateAllocationStatus();

  // Filter to items assigned to current user or unassigned
  const myAllocations = allocations?.filter(
    (a) => a.user_id === user?.id || a.user_id === null
  ).filter(a => a.status !== 'returned') || [];

  const handleMarkPickedUp = async (id: string) => {
    await updateStatus.mutateAsync({
      id,
      status: 'picked_up',
      eventId,
    });
  };

  if (isLoading) {
    return <div className="text-muted-foreground text-sm">Loading equipment...</div>;
  }

  if (myAllocations.length === 0) {
    return null;
  }

  const groupedByCategory = myAllocations.reduce((acc, alloc) => {
    const cat = alloc.equipment_item.category;
    if (!acc[cat]) acc[cat] = [];
    acc[cat].push(alloc);
    return acc;
  }, {} as Record<string, typeof myAllocations>);

  const allPickedUp = myAllocations.every((a) => a.status === 'picked_up');

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2">
          <Package className="h-4 w-4" />
          Equipment Checklist
          {allPickedUp && (
            <Badge variant="default" className="ml-auto">
              <CheckCircle className="h-3 w-3 mr-1" />
              All Picked Up
            </Badge>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {Object.entries(groupedByCategory).map(([category, items]) => (
          <div key={category} className="space-y-2">
            <h4 className="text-sm font-medium capitalize text-muted-foreground">{category}</h4>
            <div className="space-y-1">
              {items.map((alloc) => (
                <div
                  key={alloc.id}
                  className="flex items-center justify-between p-2 rounded-lg bg-muted/50"
                >
                  <div className="flex items-center gap-2">
                    {alloc.status === 'picked_up' ? (
                      <CheckCircle className="h-4 w-4 text-green-500" />
                    ) : (
                      <AlertCircle className="h-4 w-4 text-muted-foreground" />
                    )}
                    <span className="text-sm font-medium">{alloc.equipment_item.name}</span>
                    {alloc.equipment_item.brand && (
                      <span className="text-xs text-muted-foreground">
                        ({alloc.equipment_item.brand})
                      </span>
                    )}
                  </div>
                  {alloc.status === 'allocated' && (
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => handleMarkPickedUp(alloc.id)}
                      disabled={updateStatus.isPending}
                    >
                      Mark Picked Up
                    </Button>
                  )}
                  {alloc.status === 'picked_up' && (
                    <Badge variant="secondary">Picked Up</Badge>
                  )}
                </div>
              ))}
            </div>
          </div>
        ))}

        <div className="pt-4 border-t">
          <h4 className="text-sm font-medium mb-2">Pre-Event Checks</h4>
          <ul className="space-y-1 text-sm text-muted-foreground">
            <li className="flex items-center gap-2">
              <input type="checkbox" className="rounded" />
              Charge all batteries
            </li>
            <li className="flex items-center gap-2">
              <input type="checkbox" className="rounded" />
              Format memory cards
            </li>
            <li className="flex items-center gap-2">
              <input type="checkbox" className="rounded" />
              Pack chargers and cables
            </li>
            <li className="flex items-center gap-2">
              <input type="checkbox" className="rounded" />
              Test all equipment
            </li>
          </ul>
        </div>
      </CardContent>
    </Card>
  );
}
