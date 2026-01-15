import { useState, useEffect, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { format, addDays, parseISO } from 'date-fns';
import { 
  ArrowLeft, 
  Plus, 
  Calendar, 
  Users,
  Package,
  Clock,
  MapPin,
  Save,
  Rocket,
  ChevronDown,
  ChevronUp,
  AlertTriangle,
  CheckCircle2,
  Layers,
} from 'lucide-react';
import { AppLayout } from '@/components/layout/AppLayout';
import { PageHeader } from '@/components/layout/PageHeader';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { StatCard } from '@/components/ui/stat-card';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { 
  useEventSeriesDetail,
  useEventSeriesStats,
  useSeriesEvents,
  useUpdateEventSeries,
  useBulkCreateEvents,
  useBulkAssignStaff,
} from '@/hooks/useEventSeries';
import { useEventTypes, useDeliveryMethods, useStaffRoles } from '@/hooks/useLookups';
import { useProfiles } from '@/hooks/useStaff';

interface BulkEventRow {
  id: string;
  event_date: string;
  venue_name: string;
  venue_address: string;
  start_time: string;
  end_time: string;
  onsite_contact_name: string;
  onsite_contact_phone: string;
  notes: string;
}

export default function EventSeriesDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  
  const { data: series, isLoading } = useEventSeriesDetail(id);
  const { data: stats } = useEventSeriesStats(id);
  const { data: events = [] } = useSeriesEvents(id);
  const { data: eventTypes = [] } = useEventTypes();
  const { data: deliveryMethods = [] } = useDeliveryMethods();
  const { data: staffRoles = [] } = useStaffRoles();
  const { data: profiles = [] } = useProfiles();
  
  const updateSeries = useUpdateEventSeries();
  const bulkCreate = useBulkCreateEvents();
  const bulkAssign = useBulkAssignStaff();
  
  // Edit form state
  const [editName, setEditName] = useState('');
  const [editEventTypeId, setEditEventTypeId] = useState<string>('');
  const [editDeliveryMethodId, setEditDeliveryMethodId] = useState<string>('');
  const [editDeadlineDays, setEditDeadlineDays] = useState('5');
  const [editCoverage, setEditCoverage] = useState('');
  const [editNotes, setEditNotes] = useState('');
  
  // Bulk create state
  const [bulkCreateOpen, setBulkCreateOpen] = useState(false);
  const [bulkRows, setBulkRows] = useState<BulkEventRow[]>([
    createEmptyRow(),
  ]);
  const [bulkClientName, setBulkClientName] = useState('');
  const [bulkDefaultContact, setBulkDefaultContact] = useState({ name: '', phone: '' });
  
  // Bulk assign state
  const [bulkAssignOpen, setBulkAssignOpen] = useState(false);
  const [selectedEventIds, setSelectedEventIds] = useState<string[]>([]);
  const [assignUserId, setAssignUserId] = useState('');
  const [assignRoleId, setAssignRoleId] = useState('');
  const [assignNotes, setAssignNotes] = useState('');
  
  // Load series data into form
  useEffect(() => {
    if (series) {
      setEditName(series.name);
      setEditEventTypeId(series.event_type_id || '');
      setEditDeliveryMethodId(series.default_delivery_method_id || '');
      setEditDeadlineDays(String(series.default_delivery_deadline_days || 5));
      setEditCoverage(series.default_coverage_details || '');
      setEditNotes(series.notes || '');
      setBulkClientName(series.name);
    }
  }, [series]);
  
  function createEmptyRow(): BulkEventRow {
    return {
      id: crypto.randomUUID(),
      event_date: '',
      venue_name: '',
      venue_address: '',
      start_time: '18:00',
      end_time: '22:00',
      onsite_contact_name: '',
      onsite_contact_phone: '',
      notes: '',
    };
  }
  
  const handleSaveSettings = async () => {
    if (!id) return;
    await updateSeries.mutateAsync({
      id,
      name: editName,
      event_type_id: editEventTypeId || null,
      default_delivery_method_id: editDeliveryMethodId || null,
      default_delivery_deadline_days: parseInt(editDeadlineDays) || 5,
      default_coverage_details: editCoverage || null,
      notes: editNotes || null,
    });
  };
  
  const handleAddRow = () => {
    setBulkRows([...bulkRows, {
      ...createEmptyRow(),
      onsite_contact_name: bulkDefaultContact.name,
      onsite_contact_phone: bulkDefaultContact.phone,
    }]);
  };
  
  const handleRemoveRow = (rowId: string) => {
    setBulkRows(bulkRows.filter(r => r.id !== rowId));
  };
  
  const handleUpdateRow = (rowId: string, field: keyof BulkEventRow, value: string) => {
    setBulkRows(bulkRows.map(r => 
      r.id === rowId ? { ...r, [field]: value } : r
    ));
  };
  
  const handleBulkCreate = async () => {
    if (!id || !series) return;
    
    const validRows = bulkRows.filter(r => r.event_date && r.venue_name);
    if (validRows.length === 0) return;
    
    const events = validRows.map(row => ({
      event_name: `${series.name} - ${row.venue_name}`,
      client_name: bulkClientName || series.name,
      event_date: row.event_date,
      start_time: row.start_time || undefined,
      end_time: row.end_time || undefined,
      venue_name: row.venue_name,
      venue_address: row.venue_address || undefined,
      onsite_contact_name: row.onsite_contact_name || bulkDefaultContact.name || undefined,
      onsite_contact_phone: row.onsite_contact_phone || bulkDefaultContact.phone || undefined,
      event_type_id: series.event_type_id || undefined,
      event_series_id: id,
      coverage_details: series.default_coverage_details || undefined,
      delivery_method_id: series.default_delivery_method_id || undefined,
      delivery_deadline: row.event_date 
        ? format(addDays(parseISO(row.event_date), series.default_delivery_deadline_days || 5), 'yyyy-MM-dd')
        : undefined,
      notes: row.notes || undefined,
    }));
    
    await bulkCreate.mutateAsync(events);
    setBulkCreateOpen(false);
    setBulkRows([createEmptyRow()]);
  };
  
  const handleToggleEventSelection = (eventId: string) => {
    setSelectedEventIds(prev => 
      prev.includes(eventId) 
        ? prev.filter(id => id !== eventId)
        : [...prev, eventId]
    );
  };
  
  const handleSelectAllEvents = () => {
    if (selectedEventIds.length === events.length) {
      setSelectedEventIds([]);
    } else {
      setSelectedEventIds(events.map(e => e.id));
    }
  };
  
  const handleBulkAssign = async () => {
    if (selectedEventIds.length === 0 || !assignUserId) return;
    
    await bulkAssign.mutateAsync({
      eventIds: selectedEventIds,
      userId: assignUserId,
      staffRoleId: assignRoleId || undefined,
      notes: assignNotes || undefined,
    });
    
    setBulkAssignOpen(false);
    setSelectedEventIds([]);
    setAssignUserId('');
    setAssignRoleId('');
    setAssignNotes('');
  };
  
  const upcomingEvents = useMemo(() => {
    const today = new Date().toISOString().split('T')[0];
    return events.filter(e => e.event_date >= today).slice(0, 10);
  }, [events]);
  
  if (isLoading) {
    return (
      <AppLayout>
        <div className="p-8 text-center text-muted-foreground">Loading...</div>
      </AppLayout>
    );
  }
  
  if (!series) {
    return (
      <AppLayout>
        <div className="p-8 text-center text-muted-foreground">Series not found</div>
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <div className="mb-6">
        <Button variant="ghost" onClick={() => navigate('/admin/series')}>
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back to Series
        </Button>
      </div>

      <PageHeader
        title={series.name}
        description="Manage events, assignments, and settings for this series"
        actions={
          <div className="flex gap-2">
            <Dialog open={bulkCreateOpen} onOpenChange={setBulkCreateOpen}>
              <DialogTrigger asChild>
                <Button>
                  <Plus className="h-4 w-4 mr-2" />
                  Bulk Create Events
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                  <DialogTitle>Bulk Create Events</DialogTitle>
                  <DialogDescription>
                    Add multiple events to this series at once. Series defaults will be applied automatically.
                  </DialogDescription>
                </DialogHeader>
                
                <div className="space-y-6 py-4">
                  {/* Default Settings */}
                  <div className="grid grid-cols-2 gap-4 p-4 bg-muted/30 rounded-lg">
                    <div className="space-y-2">
                      <Label>Client Name</Label>
                      <Input
                        value={bulkClientName}
                        onChange={(e) => setBulkClientName(e.target.value)}
                        placeholder="Client name for all events"
                      />
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      <div className="space-y-2">
                        <Label>Default Contact Name</Label>
                        <Input
                          value={bulkDefaultContact.name}
                          onChange={(e) => setBulkDefaultContact(prev => ({ ...prev, name: e.target.value }))}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label>Default Contact Phone</Label>
                        <Input
                          value={bulkDefaultContact.phone}
                          onChange={(e) => setBulkDefaultContact(prev => ({ ...prev, phone: e.target.value }))}
                        />
                      </div>
                    </div>
                  </div>
                  
                  {/* Event Rows */}
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <Label>Events</Label>
                      <Button size="sm" variant="outline" onClick={handleAddRow}>
                        <Plus className="h-4 w-4 mr-1" />
                        Add Row
                      </Button>
                    </div>
                    
                    {bulkRows.map((row, index) => (
                      <div key={row.id} className="grid grid-cols-12 gap-2 p-3 border rounded-lg">
                        <div className="col-span-2">
                          <Input
                            type="date"
                            value={row.event_date}
                            onChange={(e) => handleUpdateRow(row.id, 'event_date', e.target.value)}
                            placeholder="Date"
                          />
                        </div>
                        <div className="col-span-2">
                          <Input
                            value={row.venue_name}
                            onChange={(e) => handleUpdateRow(row.id, 'venue_name', e.target.value)}
                            placeholder="City/Venue"
                          />
                        </div>
                        <div className="col-span-3">
                          <Input
                            value={row.venue_address}
                            onChange={(e) => handleUpdateRow(row.id, 'venue_address', e.target.value)}
                            placeholder="Address"
                          />
                        </div>
                        <div className="col-span-1">
                          <Input
                            type="time"
                            value={row.start_time}
                            onChange={(e) => handleUpdateRow(row.id, 'start_time', e.target.value)}
                          />
                        </div>
                        <div className="col-span-1">
                          <Input
                            type="time"
                            value={row.end_time}
                            onChange={(e) => handleUpdateRow(row.id, 'end_time', e.target.value)}
                          />
                        </div>
                        <div className="col-span-2">
                          <Input
                            value={row.notes}
                            onChange={(e) => handleUpdateRow(row.id, 'notes', e.target.value)}
                            placeholder="Notes"
                          />
                        </div>
                        <div className="col-span-1 flex justify-end">
                          {bulkRows.length > 1 && (
                            <Button 
                              size="sm" 
                              variant="ghost"
                              className="text-destructive"
                              onClick={() => handleRemoveRow(row.id)}
                            >
                              ×
                            </Button>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                  
                  {/* Preview */}
                  <div className="p-4 bg-muted/30 rounded-lg">
                    <h4 className="font-medium mb-2">Preview</h4>
                    <p className="text-sm text-muted-foreground">
                      {bulkRows.filter(r => r.event_date && r.venue_name).length} event(s) will be created with:
                    </p>
                    <ul className="text-sm text-muted-foreground mt-2 space-y-1">
                      <li>• Event type: {eventTypes.find(t => t.id === series.event_type_id)?.name || 'Not set'}</li>
                      <li>• Delivery method: {deliveryMethods.find(m => m.id === series.default_delivery_method_id)?.name || 'Not set'}</li>
                      <li>• Deadline: {series.default_delivery_deadline_days || 5} days after event</li>
                    </ul>
                  </div>
                </div>
                
                <DialogFooter>
                  <Button variant="outline" onClick={() => setBulkCreateOpen(false)}>
                    Cancel
                  </Button>
                  <Button 
                    onClick={handleBulkCreate} 
                    disabled={bulkCreate.isPending || bulkRows.filter(r => r.event_date && r.venue_name).length === 0}
                  >
                    <Rocket className="h-4 w-4 mr-2" />
                    Create {bulkRows.filter(r => r.event_date && r.venue_name).length} Event(s)
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
            
            {selectedEventIds.length > 0 && (
              <Dialog open={bulkAssignOpen} onOpenChange={setBulkAssignOpen}>
                <DialogTrigger asChild>
                  <Button variant="outline">
                    <Users className="h-4 w-4 mr-2" />
                    Assign Staff ({selectedEventIds.length})
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Bulk Assign Staff</DialogTitle>
                    <DialogDescription>
                      Assign a photographer to {selectedEventIds.length} selected event(s).
                    </DialogDescription>
                  </DialogHeader>
                  
                  <div className="space-y-4 py-4">
                    <div className="space-y-2">
                      <Label>Staff Member *</Label>
                      <Select value={assignUserId} onValueChange={setAssignUserId}>
                        <SelectTrigger>
                          <SelectValue placeholder="Select photographer" />
                        </SelectTrigger>
                        <SelectContent>
                          {profiles.filter(p => p.status === 'active').map(profile => (
                            <SelectItem key={profile.id} value={profile.id}>
                              {profile.full_name || profile.email}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    
                    <div className="space-y-2">
                      <Label>Role</Label>
                      <Select value={assignRoleId} onValueChange={setAssignRoleId}>
                        <SelectTrigger>
                          <SelectValue placeholder="Select role" />
                        </SelectTrigger>
                        <SelectContent>
                          {staffRoles.map(role => (
                            <SelectItem key={role.id} value={role.id}>
                              {role.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    
                    <div className="space-y-2">
                      <Label>Assignment Notes</Label>
                      <Textarea
                        value={assignNotes}
                        onChange={(e) => setAssignNotes(e.target.value)}
                        placeholder="Notes for all assignments..."
                        rows={2}
                      />
                    </div>
                  </div>
                  
                  <DialogFooter>
                    <Button variant="outline" onClick={() => setBulkAssignOpen(false)}>
                      Cancel
                    </Button>
                    <Button 
                      onClick={handleBulkAssign} 
                      disabled={bulkAssign.isPending || !assignUserId}
                    >
                      Assign to {selectedEventIds.length} Event(s)
                    </Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>
            )}
          </div>
        }
      />

      {/* Stats Dashboard */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-8">
        <StatCard
          title="Total Events"
          value={stats?.total_events || 0}
          icon={Calendar}
        />
        <StatCard
          title="Upcoming"
          value={stats?.upcoming_events || 0}
          icon={Clock}
        />
        <StatCard
          title="Delivered"
          value={stats?.delivered_events || 0}
          icon={CheckCircle2}
          variant="success"
        />
        <StatCard
          title="Pending Delivery"
          value={stats?.pending_delivery || 0}
          icon={Package}
          variant={stats?.pending_delivery && stats.pending_delivery > 0 ? 'warning' : 'default'}
        />
        <StatCard
          title="Staff Assigned"
          value={stats?.assigned_staff || 0}
          icon={Users}
        />
      </div>

      <div className="grid lg:grid-cols-3 gap-6">
        {/* Series Settings */}
        <div className="lg:col-span-1 space-y-6">
          <div className="bg-card border border-border rounded-xl p-6">
            <h2 className="text-lg font-semibold mb-4">Series Settings</h2>
            
            <div className="space-y-4">
              <div className="space-y-2">
                <Label>Series Name</Label>
                <Input
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                />
              </div>
              
              <div className="space-y-2">
                <Label>Event Type</Label>
                <Select value={editEventTypeId} onValueChange={setEditEventTypeId}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select type" />
                  </SelectTrigger>
                  <SelectContent>
                    {eventTypes.map(type => (
                      <SelectItem key={type.id} value={type.id}>
                        {type.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              
              <div className="space-y-2">
                <Label>Delivery Method</Label>
                <Select value={editDeliveryMethodId} onValueChange={setEditDeliveryMethodId}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select method" />
                  </SelectTrigger>
                  <SelectContent>
                    {deliveryMethods.map(method => (
                      <SelectItem key={method.id} value={method.id}>
                        {method.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              
              <div className="space-y-2">
                <Label>Deadline Days</Label>
                <Input
                  type="number"
                  value={editDeadlineDays}
                  onChange={(e) => setEditDeadlineDays(e.target.value)}
                  min="1"
                  max="30"
                />
              </div>
              
              <div className="space-y-2">
                <Label>Coverage Details</Label>
                <Textarea
                  value={editCoverage}
                  onChange={(e) => setEditCoverage(e.target.value)}
                  rows={3}
                />
              </div>
              
              <div className="space-y-2">
                <Label>Notes</Label>
                <Textarea
                  value={editNotes}
                  onChange={(e) => setEditNotes(e.target.value)}
                  rows={2}
                />
              </div>
              
              <div className="flex items-center justify-between pt-2">
                <Label>Active</Label>
                <Switch
                  checked={series.is_active}
                  onCheckedChange={(checked) => updateSeries.mutate({ id: series.id, is_active: checked })}
                />
              </div>
              
              <Button 
                className="w-full" 
                onClick={handleSaveSettings}
                disabled={updateSeries.isPending}
              >
                <Save className="h-4 w-4 mr-2" />
                Save Settings
              </Button>
            </div>
          </div>
        </div>

        {/* Events List */}
        <div className="lg:col-span-2">
          <div className="bg-card border border-border rounded-xl overflow-hidden">
            <div className="p-4 border-b border-border bg-muted/30 flex items-center justify-between">
              <div>
                <h2 className="font-semibold">Events in Series</h2>
                <p className="text-sm text-muted-foreground">
                  {events.length} total • {selectedEventIds.length} selected
                </p>
              </div>
              <Button size="sm" variant="outline" onClick={handleSelectAllEvents}>
                {selectedEventIds.length === events.length ? 'Deselect All' : 'Select All'}
              </Button>
            </div>
            
            {events.length === 0 ? (
              <div className="p-8 text-center text-muted-foreground">
                <Layers className="h-12 w-12 mx-auto mb-4 opacity-50" />
                <p>No events in this series yet.</p>
                <Button 
                  className="mt-4" 
                  variant="outline"
                  onClick={() => setBulkCreateOpen(true)}
                >
                  <Plus className="h-4 w-4 mr-2" />
                  Create Events
                </Button>
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-10">
                      <input
                        type="checkbox"
                        checked={selectedEventIds.length === events.length}
                        onChange={handleSelectAllEvents}
                        className="rounded"
                      />
                    </TableHead>
                    <TableHead>Date</TableHead>
                    <TableHead>Venue</TableHead>
                    <TableHead>Time</TableHead>
                    <TableHead>Delivery</TableHead>
                    <TableHead></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {events.map(event => {
                    const isSelected = selectedEventIds.includes(event.id);
                    const isPast = event.event_date < new Date().toISOString().split('T')[0];
                    
                    return (
                      <TableRow 
                        key={event.id}
                        className={isPast ? 'opacity-60' : ''}
                      >
                        <TableCell>
                          <input
                            type="checkbox"
                            checked={isSelected}
                            onChange={() => handleToggleEventSelection(event.id)}
                            className="rounded"
                          />
                        </TableCell>
                        <TableCell>
                          <div className="font-medium">
                            {format(parseISO(event.event_date), 'MMM d, yyyy')}
                          </div>
                          {isPast && (
                            <Badge variant="outline" className="text-xs mt-1">Past</Badge>
                          )}
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <MapPin className="h-4 w-4 text-muted-foreground" />
                            <div>
                              <p className="font-medium">{event.venue_name || 'TBD'}</p>
                              {event.venue_address && (
                                <p className="text-xs text-muted-foreground truncate max-w-[200px]">
                                  {event.venue_address}
                                </p>
                              )}
                            </div>
                          </div>
                        </TableCell>
                        <TableCell>
                          {event.start_time && (
                            <span className="text-sm">
                              {event.start_time.slice(0, 5)}
                              {event.end_time && ` - ${event.end_time.slice(0, 5)}`}
                            </span>
                          )}
                        </TableCell>
                        <TableCell>
                          {event.delivery_deadline && (
                            <span className="text-sm text-muted-foreground">
                              {format(parseISO(event.delivery_deadline), 'MMM d')}
                            </span>
                          )}
                        </TableCell>
                        <TableCell>
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => navigate(`/events/${event.id}`)}
                          >
                            View
                          </Button>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            )}
          </div>
        </div>
      </div>
    </AppLayout>
  );
}
