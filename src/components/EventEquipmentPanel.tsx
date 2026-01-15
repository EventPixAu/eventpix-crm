import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { 
  Plus, 
  Package, 
  Layers, 
  CheckCircle, 
  ArrowLeftRight, 
  AlertTriangle,
  Trash2,
  User
} from 'lucide-react';
import { 
  useEventAllocations, 
  useAllocateEquipment, 
  useAllocateKit,
  useUpdateAllocationStatus,
  useRemoveAllocation,
  ALLOCATION_STATUS_CONFIG,
  AllocationStatus 
} from '@/hooks/useEquipmentAllocations';
import { useAvailableEquipment } from '@/hooks/useEquipment';
import { useActiveEquipmentKits } from '@/hooks/useEquipmentKits';
import { useAuth } from '@/lib/auth';

interface EventEquipmentPanelProps {
  eventId: string;
  assignedStaff?: { userId: string; name: string }[];
}

export function EventEquipmentPanel({ eventId, assignedStaff = [] }: EventEquipmentPanelProps) {
  const { isAdmin } = useAuth();
  const { data: allocations, isLoading } = useEventAllocations(eventId);
  const { data: availableItems } = useAvailableEquipment();
  const { data: kits } = useActiveEquipmentKits();
  const allocateEquipment = useAllocateEquipment();
  const allocateKit = useAllocateKit();
  const updateStatus = useUpdateAllocationStatus();
  const removeAllocation = useRemoveAllocation();

  const [addDialogOpen, setAddDialogOpen] = useState(false);
  const [selectedItemId, setSelectedItemId] = useState('');
  const [selectedKitId, setSelectedKitId] = useState('');
  const [selectedUserId, setSelectedUserId] = useState('');
  const [statusDialogOpen, setStatusDialogOpen] = useState(false);
  const [selectedAllocation, setSelectedAllocation] = useState<{ id: string; status: AllocationStatus } | null>(null);
  const [newStatus, setNewStatus] = useState<AllocationStatus>('allocated');
  const [statusNotes, setStatusNotes] = useState('');

  const handleAllocateItem = async () => {
    if (!selectedItemId) return;
    await allocateEquipment.mutateAsync({
      eventId,
      equipmentItemId: selectedItemId,
      userId: selectedUserId || undefined,
    });
    setSelectedItemId('');
    setSelectedUserId('');
    setAddDialogOpen(false);
  };

  const handleAllocateKit = async () => {
    if (!selectedKitId) return;
    await allocateKit.mutateAsync({
      eventId,
      kitId: selectedKitId,
      userId: selectedUserId || undefined,
    });
    setSelectedKitId('');
    setSelectedUserId('');
    setAddDialogOpen(false);
  };

  const openStatusDialog = (id: string, currentStatus: AllocationStatus) => {
    setSelectedAllocation({ id, status: currentStatus });
    setNewStatus(currentStatus);
    setStatusNotes('');
    setStatusDialogOpen(true);
  };

  const handleUpdateStatus = async () => {
    if (!selectedAllocation) return;
    
    // Require notes for missing/damaged
    if ((newStatus === 'missing' || newStatus === 'damaged') && !statusNotes.trim()) {
      return;
    }

    await updateStatus.mutateAsync({
      id: selectedAllocation.id,
      status: newStatus,
      notes: statusNotes || undefined,
      eventId,
    });
    setStatusDialogOpen(false);
    setSelectedAllocation(null);
  };

  const handleRemove = async (id: string) => {
    if (confirm('Remove this allocation?')) {
      await removeAllocation.mutateAsync({ id, eventId });
    }
  };

  const getStatusBadge = (status: AllocationStatus) => {
    const config = ALLOCATION_STATUS_CONFIG[status];
    return (
      <Badge className={`${config.color} text-white`}>
        {config.label}
      </Badge>
    );
  };

  const activeAllocations = allocations?.filter(a => a.status !== 'returned') || [];
  const returnedAllocations = allocations?.filter(a => a.status === 'returned') || [];

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Package className="h-5 w-5" />
            Equipment
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center py-8">
            <div className="animate-spin h-6 w-6 border-2 border-primary border-t-transparent rounded-full" />
            <span className="ml-2 text-muted-foreground">Loading equipment...</span>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="flex items-center gap-2">
          <Package className="h-5 w-5" />
          Equipment
        </CardTitle>
        {isAdmin && (
          <Dialog open={addDialogOpen} onOpenChange={setAddDialogOpen}>
            <DialogTrigger asChild>
              <Button size="sm">
                <Plus className="h-4 w-4 mr-1" />
                Allocate
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Allocate Equipment</DialogTitle>
              </DialogHeader>
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label>Assign to Staff (Optional)</Label>
                  <Select value={selectedUserId} onValueChange={setSelectedUserId}>
                    <SelectTrigger>
                      <SelectValue placeholder="Unassigned" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="">Unassigned</SelectItem>
                      {assignedStaff.map((s) => (
                        <SelectItem key={s.userId} value={s.userId}>{s.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="border-t pt-4">
                  <Label className="flex items-center gap-2 mb-2">
                    <Layers className="h-4 w-4" />
                    Allocate Kit
                  </Label>
                  <div className="flex gap-2">
                    <Select value={selectedKitId} onValueChange={setSelectedKitId}>
                      <SelectTrigger className="flex-1">
                        <SelectValue placeholder="Select kit..." />
                      </SelectTrigger>
                      <SelectContent>
                        {kits?.map((kit) => (
                          <SelectItem key={kit.id} value={kit.id}>{kit.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <Button onClick={handleAllocateKit} disabled={!selectedKitId || allocateKit.isPending}>
                      Allocate
                    </Button>
                  </div>
                </div>

                <div className="border-t pt-4">
                  <Label className="flex items-center gap-2 mb-2">
                    <Package className="h-4 w-4" />
                    Allocate Individual Item
                  </Label>
                  <div className="flex gap-2">
                    <Select value={selectedItemId} onValueChange={setSelectedItemId}>
                      <SelectTrigger className="flex-1">
                        <SelectValue placeholder="Select item..." />
                      </SelectTrigger>
                      <SelectContent>
                        {availableItems?.map((item) => (
                          <SelectItem key={item.id} value={item.id}>
                            {item.name} ({item.category})
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <Button onClick={handleAllocateItem} disabled={!selectedItemId || allocateEquipment.isPending}>
                      Allocate
                    </Button>
                  </div>
                </div>
              </div>
            </DialogContent>
          </Dialog>
        )}
      </CardHeader>
      <CardContent>
        {activeAllocations.length > 0 ? (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Item</TableHead>
                <TableHead>Category</TableHead>
                <TableHead>Assigned To</TableHead>
                <TableHead>Status</TableHead>
                {isAdmin && <TableHead className="w-[100px]"></TableHead>}
              </TableRow>
            </TableHeader>
            <TableBody>
              {activeAllocations.map((alloc) => (
                <TableRow key={alloc.id}>
                  <TableCell className="font-medium">{alloc.equipment_item.name}</TableCell>
                  <TableCell className="capitalize">{alloc.equipment_item.category}</TableCell>
                  <TableCell>
                    {alloc.profile ? (
                      <span className="flex items-center gap-1">
                        <User className="h-3 w-3" />
                        {alloc.profile.full_name || alloc.profile.email}
                      </span>
                    ) : (
                      <span className="text-muted-foreground">Unassigned</span>
                    )}
                  </TableCell>
                  <TableCell>{getStatusBadge(alloc.status)}</TableCell>
                  {isAdmin && (
                    <TableCell>
                      <div className="flex gap-1">
                        <Button
                          size="icon"
                          variant="ghost"
                          onClick={() => openStatusDialog(alloc.id, alloc.status)}
                          title="Update status"
                        >
                          <ArrowLeftRight className="h-4 w-4" />
                        </Button>
                        <Button
                          size="icon"
                          variant="ghost"
                          onClick={() => handleRemove(alloc.id)}
                          title="Remove"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </TableCell>
                  )}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        ) : (
          <p className="text-muted-foreground text-center py-8">
            No equipment allocated to this event
          </p>
        )}

        {returnedAllocations.length > 0 && (
          <div className="mt-6 pt-4 border-t">
            <h4 className="text-sm font-medium text-muted-foreground mb-2">Returned Items</h4>
            <div className="flex flex-wrap gap-2">
              {returnedAllocations.map((alloc) => (
                <Badge key={alloc.id} variant="outline" className="text-muted-foreground">
                  <CheckCircle className="h-3 w-3 mr-1" />
                  {alloc.equipment_item.name}
                </Badge>
              ))}
            </div>
          </div>
        )}
      </CardContent>

      {/* Status Update Dialog */}
      <Dialog open={statusDialogOpen} onOpenChange={setStatusDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Update Equipment Status</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>New Status</Label>
              <Select value={newStatus} onValueChange={(v) => setNewStatus(v as AllocationStatus)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="allocated">Allocated</SelectItem>
                  <SelectItem value="picked_up">Picked Up</SelectItem>
                  <SelectItem value="returned">Returned</SelectItem>
                  <SelectItem value="missing">Missing</SelectItem>
                  <SelectItem value="damaged">Damaged</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {(newStatus === 'missing' || newStatus === 'damaged') && (
              <div className="space-y-2">
                <Label className="flex items-center gap-1">
                  <AlertTriangle className="h-4 w-4 text-destructive" />
                  Notes (Required)
                </Label>
                <Textarea
                  value={statusNotes}
                  onChange={(e) => setStatusNotes(e.target.value)}
                  placeholder="Describe the issue..."
                  required
                />
              </div>
            )}

            {newStatus !== 'missing' && newStatus !== 'damaged' && (
              <div className="space-y-2">
                <Label>Notes (Optional)</Label>
                <Textarea
                  value={statusNotes}
                  onChange={(e) => setStatusNotes(e.target.value)}
                  placeholder="Any notes..."
                />
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setStatusDialogOpen(false)}>
              Cancel
            </Button>
            <Button 
              onClick={handleUpdateStatus} 
              disabled={updateStatus.isPending || ((newStatus === 'missing' || newStatus === 'damaged') && !statusNotes.trim())}
            >
              Update Status
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}
