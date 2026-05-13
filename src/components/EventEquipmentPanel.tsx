import { useState } from 'react';
import { Link } from 'react-router-dom';
import { format, parseISO } from 'date-fns';
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
  User,
  Users,
  Camera,
  Settings2,
  ExternalLink,
  Calendar,
  Loader2
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
import { useEventSessions } from '@/hooks/useEventSessions';
import { BulkEquipmentAssignmentDialog } from './BulkEquipmentAssignmentDialog';
import { AllocatePhotographerKitDialog } from './AllocatePhotographerKitDialog';
import { StaffEquipmentPreview } from './StaffEquipmentPreview';
import { AdditionalEquipmentNotes } from './AdditionalEquipmentNotes';

function formatTime12(timeStr: string): string {
  try {
    const [h, m] = timeStr.split(':');
    const hour = parseInt(h, 10);
    const ampm = hour >= 12 ? 'PM' : 'AM';
    const h12 = hour % 12 || 12;
    return `${h12}:${m} ${ampm}`;
  } catch {
    return timeStr;
  }
}

interface EventAssignment {
  id: string;
  user_id: string | null;
  staff_id: string | null;
  profile?: { id: string; full_name: string | null; email: string } | null;
  staff?: { id: string; name: string; email: string | null } | null;
  staff_role?: { id: string; name: string } | null;
}

interface EventEquipmentPanelProps {
  eventId: string;
  assignments?: EventAssignment[];
}

export function EventEquipmentPanel({ eventId, assignments = [] }: EventEquipmentPanelProps) {
  // Build assignedStaff from assignments - includes both profile-linked and legacy staff
  const assignedStaff = assignments.map(a => {
    if (a.user_id && a.profile) {
      return { 
        oderId: a.user_id, 
        name: a.profile.full_name || a.profile.email,
        hasProfile: true 
      };
    } else if (a.staff_id && a.staff) {
      return { 
        oderId: a.staff_id, 
        name: a.staff.name,
        hasProfile: false 
      };
    }
    return null;
  }).filter((s): s is { oderId: string; name: string; hasProfile: boolean } => s !== null);
  
  // Staff with user profiles (for assigning equipment to specific people)
  const profileLinkedStaff = assignedStaff.filter(s => s.hasProfile);
  const { isAdmin } = useAuth();
  const { data: allocations, isLoading } = useEventAllocations(eventId);
  const { data: availableItems } = useAvailableEquipment();
  const { data: kits } = useActiveEquipmentKits();
  const { data: sessions = [] } = useEventSessions(eventId);
  const allocateEquipment = useAllocateEquipment();
  const allocateKit = useAllocateKit();
  const updateStatus = useUpdateAllocationStatus();
  const removeAllocation = useRemoveAllocation();

  const hasSessions = sessions.length > 0;

  const [addDialogOpen, setAddDialogOpen] = useState(false);
  const [bulkDialogOpen, setBulkDialogOpen] = useState(false);
  const [photographerKitDialogOpen, setPhotographerKitDialogOpen] = useState(false);
  const [eventPixKitDialogOpen, setEventPixKitDialogOpen] = useState(false);
  const [epKitId, setEpKitId] = useState('');
  const [epKitUserId, setEpKitUserId] = useState('');
  const [epKitSessionId, setEpKitSessionId] = useState('');
  const [selectedItemId, setSelectedItemId] = useState('');
  const [selectedKitId, setSelectedKitId] = useState('');
  const [selectedUserId, setSelectedUserId] = useState('');
  const [selectedSessionId, setSelectedSessionId] = useState('');
  const [statusDialogOpen, setStatusDialogOpen] = useState(false);
  const [selectedAllocation, setSelectedAllocation] = useState<{ id: string; status: AllocationStatus; userId: string | null } | null>(null);
  const [newStatus, setNewStatus] = useState<AllocationStatus>('allocated');
  const [newAssigneeId, setNewAssigneeId] = useState<string>('');
  const [statusNotes, setStatusNotes] = useState('');

  const handleAllocateEventPixKit = async () => {
    if (!epKitId) return;
    await allocateKit.mutateAsync({
      eventId,
      kitId: epKitId,
      userId: epKitUserId && epKitUserId !== 'unassigned' ? epKitUserId : undefined,
      sessionId: epKitSessionId && epKitSessionId !== 'all' ? epKitSessionId : undefined,
    });
    setEpKitId('');
    setEpKitUserId('');
    setEpKitSessionId('');
    setEventPixKitDialogOpen(false);
  };

  const handleAllocateItem = async () => {
    if (!selectedItemId) return;
    await allocateEquipment.mutateAsync({
      eventId,
      equipmentItemId: selectedItemId,
      userId: selectedUserId && selectedUserId !== 'unassigned' ? selectedUserId : undefined,
      sessionId: selectedSessionId && selectedSessionId !== 'all' ? selectedSessionId : undefined,
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
      userId: selectedUserId && selectedUserId !== 'unassigned' ? selectedUserId : undefined,
      sessionId: selectedSessionId && selectedSessionId !== 'all' ? selectedSessionId : undefined,
    });
    setSelectedKitId('');
    setSelectedUserId('');
    setAddDialogOpen(false);
  };

  const openStatusDialog = (id: string, currentStatus: AllocationStatus, currentUserId: string | null) => {
    setSelectedAllocation({ id, status: currentStatus, userId: currentUserId });
    setNewStatus(currentStatus);
    setNewAssigneeId(currentUserId || 'unassigned');
    setStatusNotes('');
    setStatusDialogOpen(true);
  };

  const handleUpdateStatus = async () => {
    if (!selectedAllocation) return;
    
    // Require notes for missing/damaged
    if ((newStatus === 'missing' || newStatus === 'damaged') && !statusNotes.trim()) {
      return;
    }

    // Determine if assignment changed
    const newUserId = newAssigneeId === 'unassigned' ? null : newAssigneeId;
    const assignmentChanged = newUserId !== selectedAllocation.userId;

    await updateStatus.mutateAsync({
      id: selectedAllocation.id,
      status: newStatus,
      notes: statusNotes || undefined,
      userId: assignmentChanged ? newUserId : undefined,
      eventId,
    });
    setStatusDialogOpen(false);
    setSelectedAllocation(null);
  };

  const handleRemove = async (id: string) => {
    if (removeAllocation.isPending) return;
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

  // Separate photographer-owned items from EventPix/individual items
  const photographerAllocations = activeAllocations.filter(a => (a.equipment_item as any)?.owner_user_id);
  const nonPhotographerAllocations = activeAllocations.filter(a => !(a.equipment_item as any)?.owner_user_id);

  // Group photographer allocations by owner + category as collapsed kits
  const photographerKitGroups = photographerAllocations.reduce((acc, alloc) => {
    const ownerId = (alloc.equipment_item as any).owner_user_id as string;
    const category = alloc.equipment_item.category || 'other';
    const key = `${ownerId}__${category}`;
    if (!acc[key]) {
      acc[key] = {
        ownerId,
        ownerName: alloc.profile?.full_name || alloc.profile?.email || 'Unknown',
        category,
        allocations: [],
      };
    }
    acc[key].allocations.push(alloc);
    return acc;
  }, {} as Record<string, { ownerId: string; ownerName: string; category: string; allocations: typeof activeAllocations }>);

  // Group non-photographer allocations by kit for display
  const groupedAllocations = nonPhotographerAllocations.reduce((acc, alloc) => {
    const kitId = alloc.kit_id || 'individual';
    if (!acc[kitId]) {
      acc[kitId] = {
        kitId: alloc.kit_id,
        kitName: alloc.equipment_kit?.name || null,
        otherItems: alloc.equipment_kit?.other_items || null,
        allocations: [],
      };
    }
    acc[kitId].allocations.push(alloc);
    return acc;
  }, {} as Record<string, { kitId: string | null; kitName: string | null; otherItems: string[] | null; allocations: typeof activeAllocations }>);

  const kitGroups = Object.values(groupedAllocations).sort((a, b) => {
    // Show kits first, then individual items
    if (a.kitName && !b.kitName) return -1;
    if (!a.kitName && b.kitName) return 1;
    return (a.kitName || '').localeCompare(b.kitName || '');
  });

  const photographerKitList = Object.values(photographerKitGroups).sort((a, b) => 
    a.ownerName.localeCompare(b.ownerName) || a.category.localeCompare(b.category)
  );

  const [expandedPhotographerKits, setExpandedPhotographerKits] = useState<Set<string>>(new Set());
  const togglePhotographerKit = (key: string) => {
    setExpandedPhotographerKits(prev => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

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
          <div className="flex gap-2">
            <Dialog open={eventPixKitDialogOpen} onOpenChange={setEventPixKitDialogOpen}>
              <DialogTrigger asChild>
                <Button size="sm" variant="outline">
                  <Layers className="h-4 w-4 mr-1" />
                  EventPix Kits
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Allocate EventPix Kit</DialogTitle>
                </DialogHeader>
                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label>Select Kit</Label>
                    <Select value={epKitId} onValueChange={setEpKitId}>
                      <SelectTrigger>
                        <SelectValue placeholder="Choose an equipment kit..." />
                      </SelectTrigger>
                      <SelectContent>
                        {kits?.map((kit) => (
                          <SelectItem key={kit.id} value={kit.id}>
                            {kit.name}
                            {kit.description ? ` — ${kit.description}` : ''}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>Assign to Staff (Optional)</Label>
                    <Select value={epKitUserId} onValueChange={setEpKitUserId}>
                      <SelectTrigger>
                        <SelectValue placeholder="Unassigned" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="unassigned">Unassigned</SelectItem>
                        {profileLinkedStaff.map((s) => (
                          <SelectItem key={s.oderId} value={s.oderId}>{s.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  {hasSessions && (
                    <div className="space-y-2">
                      <Label>Session / Day (Optional)</Label>
                      <Select value={epKitSessionId} onValueChange={setEpKitSessionId}>
                        <SelectTrigger>
                          <SelectValue placeholder="All Sessions" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="all">All Sessions</SelectItem>
                          {sessions.map((s) => (
                            <SelectItem key={s.id} value={s.id}>
                              {format(parseISO(s.session_date), 'EEE, d MMM')}
                              {s.start_time ? ` • ${formatTime12(s.start_time)}` : ''}
                              {s.label ? ` – ${s.label}` : ''}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  )}
                </div>
                <DialogFooter>
                  <Button variant="outline" onClick={() => setEventPixKitDialogOpen(false)}>Cancel</Button>
                  <Button 
                    onClick={handleAllocateEventPixKit} 
                    disabled={!epKitId || allocateKit.isPending}
                  >
                    {allocateKit.isPending ? 'Allocating...' : 'Allocate Kit'}
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
            <Button size="sm" variant="outline" onClick={() => setPhotographerKitDialogOpen(true)}>
              <Camera className="h-4 w-4 mr-1" />
              Photographer Kits
            </Button>
            <Button size="sm" variant="outline" onClick={() => setBulkDialogOpen(true)}>
              <Users className="h-4 w-4 mr-1" />
              Bulk Assign
            </Button>
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
                      <SelectItem value="unassigned">Unassigned</SelectItem>
                      {profileLinkedStaff.map((s) => (
                        <SelectItem key={s.oderId} value={s.oderId}>{s.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {selectedUserId && selectedUserId !== 'unassigned' && (
                    <StaffEquipmentPreview
                      userId={selectedUserId}
                      eventId={eventId}
                      sessionId={selectedSessionId && selectedSessionId !== 'all' ? selectedSessionId : undefined}
                    />
                  )}
                </div>

                {hasSessions && (
                  <div className="space-y-2">
                    <Label>Session / Day (Optional)</Label>
                    <Select value={selectedSessionId} onValueChange={setSelectedSessionId}>
                      <SelectTrigger>
                        <SelectValue placeholder="All Sessions" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All Sessions</SelectItem>
                        {sessions.map((s) => (
                          <SelectItem key={s.id} value={s.id}>
                            {format(parseISO(s.session_date), 'EEE, d MMM')}
                            {s.start_time ? ` • ${formatTime12(s.start_time)}` : ''}
                            {s.label ? ` – ${s.label}` : ''}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                )}

                <div className="border-t pt-4">
                  <div className="flex items-center justify-between mb-2">
                    <Label className="flex items-center gap-2">
                      <Layers className="h-4 w-4" />
                      Allocate EventPix Kit
                    </Label>
                    <Link to="/equipment?tab=kits" className="text-xs text-primary hover:underline flex items-center gap-1">
                      <Settings2 className="h-3 w-3" />
                      Manage Kits
                    </Link>
                  </div>
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
          </div>
        )}
        
        <BulkEquipmentAssignmentDialog
          open={bulkDialogOpen}
          onOpenChange={setBulkDialogOpen}
          eventId={eventId}
          preselectedStaffIds={profileLinkedStaff.map(s => s.oderId)}
        />
        
        <AllocatePhotographerKitDialog
          open={photographerKitDialogOpen}
          onOpenChange={setPhotographerKitDialogOpen}
          eventId={eventId}
          assignments={assignments}
        />
      </CardHeader>
      <CardContent>
        {(kitGroups.length > 0 || photographerKitList.length > 0) ? (
          <div className="space-y-6">
            {/* Photographer Kits - collapsed summary */}
            {photographerKitList.length > 0 && (
              <div className="space-y-2">
                <div className="flex items-center gap-2 pb-2 border-b">
                  <Camera className="h-4 w-4 text-primary" />
                  <span className="font-medium">Photographer Kits</span>
                  <Badge variant="secondary" className="text-xs">{photographerAllocations.length} items</Badge>
                </div>
                <div className="space-y-1">
                  {photographerKitList.map((pg) => {
                    const key = `${pg.ownerId}__${pg.category}`;
                    const isExpanded = expandedPhotographerKits.has(key);
                    const categoryLabel = pg.category.charAt(0).toUpperCase() + pg.category.slice(1);
                    return (
                      <div key={key}>
                        <button
                          onClick={() => togglePhotographerKit(key)}
                          className="w-full flex items-center justify-between px-3 py-2 rounded-lg hover:bg-muted/50 transition-colors text-left"
                        >
                          <div className="flex items-center gap-2">
                            <User className="h-3 w-3 text-muted-foreground" />
                            <span className="text-sm font-medium">{pg.ownerName}</span>
                            <span className="text-xs text-muted-foreground">— {categoryLabel} Kit</span>
                            <Badge variant="outline" className="text-xs">{pg.allocations.length} items</Badge>
                          </div>
                          <div className="flex items-center gap-2">
                            {getStatusBadge(pg.allocations[0].status)}
                            <span className="text-xs text-muted-foreground">{isExpanded ? '▲' : '▼'}</span>
                          </div>
                        </button>
                        {isExpanded && (
                          <Table>
                            <TableHeader>
                              <TableRow>
                                <TableHead>Item</TableHead>
                                <TableHead>Category</TableHead>
                                {hasSessions && <TableHead>Session</TableHead>}
                                <TableHead>Status</TableHead>
                                {isAdmin && <TableHead className="w-[100px]"></TableHead>}
                              </TableRow>
                            </TableHeader>
                            <TableBody>
                              {pg.allocations.map((alloc) => (
                                <TableRow key={alloc.id}>
                                  <TableCell className="font-medium">{alloc.equipment_item.name}</TableCell>
                                  <TableCell className="capitalize">{alloc.equipment_item.category}</TableCell>
                                  {hasSessions && (
                                    <TableCell>
                                      {alloc.session ? (
                                        <span className="flex items-center gap-1 text-xs">
                                          <Calendar className="h-3 w-3 text-primary" />
                                          {format(parseISO(alloc.session.session_date), 'EEE, d MMM')}
                                        </span>
                                      ) : (
                                        <span className="text-xs text-muted-foreground">All</span>
                                      )}
                                    </TableCell>
                                  )}
                                  <TableCell>{getStatusBadge(alloc.status)}</TableCell>
                                  {isAdmin && (
                                    <TableCell>
                                      <div className="flex gap-1">
                                        <Button size="icon" variant="ghost" onClick={() => openStatusDialog(alloc.id, alloc.status, alloc.user_id)} title="Update status">
                                          <ArrowLeftRight className="h-4 w-4" />
                                        </Button>
                                        <Button size="icon" variant="ghost" onClick={() => handleRemove(alloc.id)} disabled={removeAllocation.isPending} title="Remove">
                                          {removeAllocation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
                                        </Button>
                                      </div>
                                    </TableCell>
                                  )}
                                </TableRow>
                              ))}
                            </TableBody>
                          </Table>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* EventPix Kits & Individual Items */}
            {kitGroups.map((group) => (
              <div key={group.kitId || 'individual'} className="space-y-2">
                {/* Kit Header */}
                {group.kitName && group.kitId && (
                  <div className="flex items-center gap-2 pb-2 border-b">
                    <Layers className="h-4 w-4 text-primary" />
                    <Link 
                      to={`/equipment?tab=kits`} 
                      className="font-medium hover:text-primary hover:underline flex items-center gap-1"
                    >
                      {group.kitName}
                      <ExternalLink className="h-3 w-3" />
                    </Link>
                    <Badge variant="secondary" className="text-xs">Kit</Badge>
                  </div>
                )}

                {/* Header for individual items section */}
                {!group.kitName && (
                  <div className="flex items-center gap-2 pb-2 border-b">
                    <Package className="h-4 w-4 text-muted-foreground" />
                    <span className="font-medium text-muted-foreground">Individual Items</span>
                  </div>
                )}
                
                {/* Kit Items Table */}
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Item</TableHead>
                      <TableHead>Category</TableHead>
                      {hasSessions && <TableHead>Session</TableHead>}
                      <TableHead>Assigned To</TableHead>
                      <TableHead>Status</TableHead>
                      {isAdmin && <TableHead className="w-[100px]"></TableHead>}
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {group.allocations.map((alloc) => (
                      <TableRow key={alloc.id}>
                        <TableCell className="font-medium">{alloc.equipment_item.name}</TableCell>
                        <TableCell className="capitalize">{alloc.equipment_item.category}</TableCell>
                        {hasSessions && (
                          <TableCell>
                            {alloc.session ? (
                              <span className="flex items-center gap-1 text-xs">
                                <Calendar className="h-3 w-3 text-primary" />
                                {format(parseISO(alloc.session.session_date), 'EEE, d MMM')}
                              </span>
                            ) : (
                              <span className="text-xs text-muted-foreground">All</span>
                            )}
                          </TableCell>
                        )}
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
                                onClick={() => openStatusDialog(alloc.id, alloc.status, alloc.user_id)}
                                title="Update status"
                              >
                                <ArrowLeftRight className="h-4 w-4" />
                              </Button>
                              <Button
                                size="icon"
                                variant="ghost"
                                onClick={() => handleRemove(alloc.id)}
                                disabled={removeAllocation.isPending}
                                title="Remove"
                              >
                                {removeAllocation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
                              </Button>
                            </div>
                          </TableCell>
                        )}
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>

                {/* Other Items in Kit */}
                {group.otherItems && group.otherItems.length > 0 && (
                  <div className="flex flex-wrap gap-2 pt-2 pl-2">
                    <span className="text-xs text-muted-foreground mr-1">Also includes:</span>
                    {group.otherItems.map((item, idx) => (
                      <Badge key={idx} variant="outline" className="text-xs">
                        {item}
                      </Badge>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
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

        <div className="mt-6">
          <AdditionalEquipmentNotes eventId={eventId} canEdit={!!isAdmin} />
        </div>
      </CardContent>

      {/* Status Update Dialog */}
      <Dialog open={statusDialogOpen} onOpenChange={setStatusDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Update Equipment</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Assign To</Label>
              <Select value={newAssigneeId} onValueChange={setNewAssigneeId}>
                <SelectTrigger>
                  <SelectValue placeholder="Unassigned" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="unassigned">Unassigned</SelectItem>
                  {profileLinkedStaff.map((s) => (
                    <SelectItem key={s.oderId} value={s.oderId}>{s.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Status</Label>
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
