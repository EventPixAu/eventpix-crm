import { useState, useMemo } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { format, parseISO } from 'date-fns';
import { 
  ArrowLeft, 
  Plus, 
  Calendar, 
  Users,
  Package,
  Clock,
  MapPin,
  Save,
  CheckCircle2,
  Layers,
  Wand2,
  AlertTriangle,
  Truck,
  Settings2,
  FileText,
  BarChart3,
  ChevronRight,
  Eye,
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
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { 
  useEventSeriesDetail,
  useSeriesEvents,
  useUpdateEventSeries,
  useBulkAssignStaff,
} from '@/hooks/useEventSeries';
import {
  useSeriesOverview,
  useSeriesCoverage,
  useSeriesDelivery,
  useSeriesNeedsAttention,
} from '@/hooks/useSeriesControlCentre';
import { useEventTypes, useDeliveryMethods, useStaffRoles } from '@/hooks/useLookups';
import { useOpsStatuses } from '@/hooks/useOpsStatuses';
import { BulkEventCreationDialog } from '@/components/BulkEventCreationDialog';
import { RecommendCrewDialog } from '@/components/RecommendCrewDialog';
import { StaffingForecast } from '@/components/StaffingForecast';
import { SeriesBulkActionsDialog } from '@/components/SeriesBulkActionsDialog';
import { BulkAssignmentDialog } from '@/components/BulkAssignmentDialog';
import { SeriesCostSummary } from '@/components/SeriesCostSummary';
import { SeriesRepeatIndicators } from '@/components/SeriesRepeatIndicators';
import { cn } from '@/lib/utils';
import { useAuth } from '@/lib/auth';
 import { SeriesDefaultAssignmentsPanel } from '@/components/SeriesDefaultAssignmentsPanel';
 import { SeriesWorkflowPanel } from '@/components/SeriesWorkflowPanel';
 import { ListChecks } from 'lucide-react';

export default function EventSeriesDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { isAdmin } = useAuth();
  
  const { data: series, isLoading } = useEventSeriesDetail(id);
  const { data: events = [] } = useSeriesEvents(id);
  const { data: overview } = useSeriesOverview(id);
  const { data: coverage = [] } = useSeriesCoverage(id);
  const { data: delivery = [] } = useSeriesDelivery(id);
  const { data: needsAttention = [] } = useSeriesNeedsAttention(id);
  const { data: eventTypes = [] } = useEventTypes();
  const { data: deliveryMethods = [] } = useDeliveryMethods();
  const { data: staffRoles = [] } = useStaffRoles();
  const { data: opsStatuses = [] } = useOpsStatuses();
  
  const updateSeries = useUpdateEventSeries();
  
  // Tabs state
  const [activeTab, setActiveTab] = useState('overview');
  
  // Edit form state
  const [editName, setEditName] = useState('');
  const [editEventTypeId, setEditEventTypeId] = useState<string>('');
  const [editDeliveryMethodId, setEditDeliveryMethodId] = useState<string>('');
  const [editDeadlineDays, setEditDeadlineDays] = useState('5');
  const [editCoverage, setEditCoverage] = useState('');
  const [editNotes, setEditNotes] = useState('');
  const [editVenueCity, setEditVenueCity] = useState('');
  const [editNotesPublic, setEditNotesPublic] = useState('');
  const [editNotesInternal, setEditNotesInternal] = useState('');
  const [editStartTime, setEditStartTime] = useState('');
  const [editEndTime, setEditEndTime] = useState('');
  const [editDefaultOpsStatus, setEditDefaultOpsStatus] = useState('confirmed');
  const [editDefaultGuestDeliveryId, setEditDefaultGuestDeliveryId] = useState<string>('');
  
  // Dialog states
  const [bulkCreateOpen, setBulkCreateOpen] = useState(false);
  const [recommendCrewOpen, setRecommendCrewOpen] = useState(false);
  const [bulkAssignOpen, setBulkAssignOpen] = useState(false);
  const [bulkActionType, setBulkActionType] = useState<'event_type' | 'delivery_method' | 'delivery_deadline' | 'add_note' | null>(null);
  
  // Selection state
  const [selectedEventIds, setSelectedEventIds] = useState<string[]>([]);
  const [needsAttentionFilter, setNeedsAttentionFilter] = useState<string>('all');
  
  // Load series data into form
  useState(() => {
    if (series) {
      setEditName(series.name);
      setEditEventTypeId(series.event_type_id || '');
      setEditDeliveryMethodId(series.default_delivery_method_id || '');
      setEditDeadlineDays(String(series.default_delivery_deadline_days || 5));
      setEditCoverage(series.default_coverage_details || '');
      setEditNotes(series.notes || '');
      setEditVenueCity((series as any).default_venue_city || '');
      setEditNotesPublic((series as any).default_notes_public || '');
      setEditNotesInternal((series as any).default_notes_internal || '');
      setEditStartTime((series as any).default_start_time || '');
      setEditEndTime((series as any).default_end_time || '');
      setEditDefaultOpsStatus((series as any).default_ops_status || 'confirmed');
      setEditDefaultGuestDeliveryId((series as any).default_delivery_method_guests_id || '');
    }
  });
  
  // Update form when series loads
  useMemo(() => {
    if (series) {
      setEditName(series.name);
      setEditEventTypeId(series.event_type_id || '');
      setEditDeliveryMethodId(series.default_delivery_method_id || '');
      setEditDeadlineDays(String(series.default_delivery_deadline_days || 5));
      setEditCoverage(series.default_coverage_details || '');
      setEditNotes(series.notes || '');
      setEditVenueCity((series as any).default_venue_city || '');
      setEditNotesPublic((series as any).default_notes_public || '');
      setEditNotesInternal((series as any).default_notes_internal || '');
      setEditStartTime((series as any).default_start_time || '');
      setEditEndTime((series as any).default_end_time || '');
      setEditDefaultOpsStatus((series as any).default_ops_status || 'confirmed');
      setEditDefaultGuestDeliveryId((series as any).default_delivery_method_guests_id || '');
    }
  }, [series]);
  
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
    } as any);
    // Save time fields separately since they may not be in the typed interface yet
    if (id) {
      const { error } = await supabase
        .from('event_series')
        .update({
          default_start_time: editStartTime || null,
          default_end_time: editEndTime || null,
        } as any)
        .eq('id', id);
      if (error) console.error('Failed to save times:', error);
    }
  };
  
  const handleToggleEventSelection = (eventId: string) => {
    setSelectedEventIds(prev => 
      prev.includes(eventId) 
        ? prev.filter(id => id !== eventId)
        : [...prev, eventId]
    );
  };
  
  const handleSelectAllEvents = (eventsList: Array<{ eventId?: string; id?: string }>) => {
    const ids = eventsList.map(e => e.eventId || e.id || '').filter(Boolean);
    if (selectedEventIds.length === ids.length) {
      setSelectedEventIds([]);
    } else {
      setSelectedEventIds(ids);
    }
  };
  
  // Get unassigned upcoming event IDs for recommendation
  const unassignedEventIds = useMemo(() => {
    const today = new Date().toISOString().split('T')[0];
    return events
      .filter(e => e.event_date >= today)
      .map(e => e.id);
  }, [events]);
  
  // Filtered needs attention
  const filteredNeedsAttention = useMemo(() => {
    if (needsAttentionFilter === 'all') return needsAttention;
    return needsAttention.filter(item => 
      item.issues.some(issue => issue.toLowerCase().includes(needsAttentionFilter.toLowerCase()))
    );
  }, [needsAttention, needsAttentionFilter]);
  
  // Coverage stats
  const coverageStats = useMemo(() => {
    const missingAny = coverage.filter(c => c.assignmentCount === 0);
    const missingLead = coverage.filter(c => c.assignmentCount > 0 && !c.hasLead);
    const multiDay = coverage.filter(c => c.staffOnSameDay.length > 0);
    const conflicts = coverage.filter(c => c.hardConflicts.length > 0);
    return { missingAny, missingLead, multiDay, conflicts };
  }, [coverage]);
  
  // Delivery stats
  const deliveryStats = useMemo(() => {
    const today = new Date();
    const sevenDaysFromNow = new Date();
    sevenDaysFromNow.setDate(today.getDate() + 7);
    
    const dueNext7Days = delivery.filter(d => 
      d.deliveryDeadline && 
      d.daysUntilDeadline !== null && 
      d.daysUntilDeadline >= 0 && 
      d.daysUntilDeadline <= 7 &&
      !d.deliveredAt
    );
    const overdue = delivery.filter(d => d.isOverdue);
    const missingLink = delivery.filter(d => !d.hasDeliveryLink && !d.deliveredAt);
    
    return { dueNext7Days, overdue, missingLink };
  }, [delivery]);
  
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
        description="Program Control Centre - Manage events, staffing, and delivery"
        actions={
          <div className="flex gap-2 flex-wrap">
            {unassignedEventIds.length > 0 && (
              <Button variant="outline" onClick={() => setRecommendCrewOpen(true)}>
                <Wand2 className="h-4 w-4 mr-2" />
                Recommend Crew
              </Button>
            )}
            
            <Button onClick={() => setBulkCreateOpen(true)}>
              <Plus className="h-4 w-4 mr-2" />
              Bulk Create Events
            </Button>
          </div>
        }
      />

      {/* Selection Actions Bar */}
      {selectedEventIds.length > 0 && (
        <div className="mb-4 p-3 bg-primary/10 border border-primary/20 rounded-lg flex items-center justify-between">
          <span className="text-sm font-medium">
            {selectedEventIds.length} event{selectedEventIds.length !== 1 ? 's' : ''} selected
          </span>
          <div className="flex gap-2">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="sm">
                  <Settings2 className="h-4 w-4 mr-2" />
                  Bulk Actions
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={() => setBulkActionType('event_type')}>
                  <Settings2 className="h-4 w-4 mr-2" />
                  Set Event Type
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => setBulkActionType('delivery_method')}>
                  <Truck className="h-4 w-4 mr-2" />
                  Set Delivery Method
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => setBulkActionType('delivery_deadline')}>
                  <Calendar className="h-4 w-4 mr-2" />
                  Set Delivery Deadline
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={() => setBulkActionType('add_note')}>
                  <FileText className="h-4 w-4 mr-2" />
                  Add Note
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
            
            <Button size="sm" onClick={() => setBulkAssignOpen(true)}>
              <Users className="h-4 w-4 mr-2" />
              Assign Staff
            </Button>
            
            <Button variant="ghost" size="sm" onClick={() => setSelectedEventIds([])}>
              Clear Selection
            </Button>
          </div>
        </div>
      )}

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
          <TabsList className="grid grid-cols-7 w-full max-w-4xl">
          <TabsTrigger value="overview" className="flex items-center gap-2">
            <BarChart3 className="h-4 w-4" />
            Overview
          </TabsTrigger>
           <TabsTrigger value="assignments" className="flex items-center gap-2">
             <Users className="h-4 w-4" />
             Assignments
           </TabsTrigger>
           <TabsTrigger value="workflow" className="flex items-center gap-2">
             <ListChecks className="h-4 w-4" />
             Workflow
           </TabsTrigger>
          <TabsTrigger value="coverage" className="flex items-center gap-2">
            <Users className="h-4 w-4" />
            Coverage
            {coverageStats.missingAny.length > 0 && (
              <Badge variant="destructive" className="ml-1 h-5 w-5 p-0 flex items-center justify-center text-xs">
                {coverageStats.missingAny.length}
              </Badge>
            )}
          </TabsTrigger>
          <TabsTrigger value="delivery" className="flex items-center gap-2">
            <Truck className="h-4 w-4" />
            Delivery
            {deliveryStats.overdue.length > 0 && (
              <Badge variant="destructive" className="ml-1 h-5 w-5 p-0 flex items-center justify-center text-xs">
                {deliveryStats.overdue.length}
              </Badge>
            )}
          </TabsTrigger>
          <TabsTrigger value="attention" className="flex items-center gap-2">
            <AlertTriangle className="h-4 w-4" />
            Attention
            {needsAttention.length > 0 && (
              <Badge variant="secondary" className="ml-1 h-5 w-5 p-0 flex items-center justify-center text-xs bg-amber-500/20 text-amber-700">
                {needsAttention.length}
              </Badge>
            )}
          </TabsTrigger>
          <TabsTrigger value="settings" className="flex items-center gap-2">
            <Settings2 className="h-4 w-4" />
            Settings
          </TabsTrigger>
        </TabsList>

        {/* Overview Tab */}
        <TabsContent value="overview" className="space-y-6">
          {/* Repeat Revenue Indicators */}
          {id && <SeriesRepeatIndicators seriesId={id} />}
          
          <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
            <StatCard
              title="Total Events"
              value={overview?.totalEvents || 0}
              icon={Calendar}
            />
            <StatCard
              title="This Week"
              value={overview?.eventsThisWeek || 0}
              icon={Clock}
            />
            <StatCard
              title="Next 30 Days"
              value={overview?.eventsNext30Days || 0}
              icon={Calendar}
            />
            <StatCard
              title="Needs Attention"
              value={needsAttention.length}
              icon={AlertTriangle}
              variant={needsAttention.length > 0 ? 'warning' : 'default'}
            />
            <StatCard
              title="Unassigned"
              value={coverageStats.missingAny.length}
              icon={Users}
              variant={coverageStats.missingAny.length > 0 ? 'warning' : 'success'}
            />
          </div>

          <div className="grid lg:grid-cols-3 gap-6">
            {/* Events List - spans 2 columns */}
            <div className="lg:col-span-2">
              <Card>
                <CardHeader>
                  <CardTitle className="text-base flex items-center gap-2">
                    <Calendar className="h-4 w-4" />
                    Booked Events
                    {overview?.dateRange.start && (
                      <span className="text-sm font-normal text-muted-foreground ml-2">
                        {format(parseISO(overview.dateRange.start), 'MMM d, yyyy')}
                        {' — '}
                        {overview.dateRange.end && format(parseISO(overview.dateRange.end), 'MMM d, yyyy')}
                      </span>
                    )}
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {events.length === 0 ? (
                    <p className="text-sm text-muted-foreground text-center py-4">No events yet</p>
                  ) : (
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Event</TableHead>
                          <TableHead>Date</TableHead>
                          <TableHead>Venue</TableHead>
                          <TableHead>Staff</TableHead>
                          <TableHead>Status</TableHead>
                          <TableHead className="w-10"></TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {[...events]
                          .sort((a, b) => a.event_date.localeCompare(b.event_date))
                          .map(event => (
                            <TableRow key={event.id}>
                              <TableCell className="font-medium">{event.event_name}</TableCell>
                              <TableCell>{format(parseISO(event.event_date), 'EEE, MMM d, yyyy')}</TableCell>
                              <TableCell className="text-muted-foreground">{event.venue_name || '-'}</TableCell>
                              <TableCell>
                                <Badge variant={(event.event_assignments?.length || 0) === 0 ? 'destructive' : 'secondary'}>
                                  {event.event_assignments?.length || 0} assigned
                                </Badge>
                              </TableCell>
                              <TableCell>
                                <Badge variant="outline" className="capitalize">
                                  {(event.ops_status || 'pending').replace(/_/g, ' ')}
                                </Badge>
                              </TableCell>
                              <TableCell>
                                <Button variant="ghost" size="icon" asChild>
                                  <Link to={`/events/${event.id}`}>
                                    <Eye className="h-4 w-4" />
                                  </Link>
                                </Button>
                              </TableCell>
                            </TableRow>
                          ))}
                      </TableBody>
                    </Table>
                  )}
                </CardContent>
              </Card>
            </div>

            {/* Column 3: Staffing + Cost */}
            <div className="space-y-6">
              <StaffingForecast 
                seriesId={id!} 
                defaultPhotographersRequired={series.default_photographers_required || 1}
              />

              {isAdmin && events.length > 0 && (
                <SeriesCostSummary 
                  seriesId={id!} 
                  eventIds={events.map(e => e.id)}
                />
              )}
            </div>
          </div>
        </TabsContent>

         {/* Assignments Tab */}
         <TabsContent value="assignments">
           <SeriesDefaultAssignmentsPanel seriesId={id!} />
         </TabsContent>
  
         {/* Workflow Tab */}
         <TabsContent value="workflow">
           <SeriesWorkflowPanel seriesId={id!} />
         </TabsContent>
 
        {/* Coverage Tab */}
        <TabsContent value="coverage" className="space-y-4">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <StatCard
              title="No Staff"
              value={coverageStats.missingAny.length}
              icon={Users}
              variant={coverageStats.missingAny.length > 0 ? 'warning' : 'success'}
            />
            <StatCard
              title="Missing Lead"
              value={coverageStats.missingLead.length}
              icon={Users}
              variant={coverageStats.missingLead.length > 0 ? 'warning' : 'default'}
            />
            <StatCard
              title="Multi-Day Staff"
              value={coverageStats.multiDay.length}
              icon={AlertTriangle}
              variant={coverageStats.multiDay.length > 0 ? 'warning' : 'default'}
            />
            <StatCard
              title="Conflicts"
              value={coverageStats.conflicts.length}
              icon={AlertTriangle}
              variant={coverageStats.conflicts.length > 0 ? 'warning' : 'success'}
            />
          </div>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardTitle>Staffing Issues</CardTitle>
                <CardDescription>Events with coverage problems</CardDescription>
              </div>
              <Button 
                size="sm" 
                variant="outline"
                onClick={() => handleSelectAllEvents(coverage.filter(c => c.assignmentCount === 0 || !c.hasLead))}
              >
                Select All Issues
              </Button>
            </CardHeader>
            <CardContent>
              {coverage.filter(c => c.assignmentCount === 0 || !c.hasLead || c.staffOnSameDay.length > 0).length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <CheckCircle2 className="h-12 w-12 mx-auto mb-2 text-green-500" />
                  <p>All events have adequate coverage</p>
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-10">
                        <Checkbox 
                          checked={selectedEventIds.length > 0}
                          onCheckedChange={() => handleSelectAllEvents(coverage.filter(c => c.assignmentCount === 0 || !c.hasLead))}
                        />
                      </TableHead>
                      <TableHead>Event</TableHead>
                      <TableHead>Date</TableHead>
                      <TableHead>Location</TableHead>
                      <TableHead>Staff</TableHead>
                      <TableHead>Issues</TableHead>
                      <TableHead></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {coverage
                      .filter(c => c.assignmentCount === 0 || !c.hasLead || c.staffOnSameDay.length > 0)
                      .map(item => (
                        <TableRow key={item.eventId}>
                          <TableCell>
                            <Checkbox
                              checked={selectedEventIds.includes(item.eventId)}
                              onCheckedChange={() => handleToggleEventSelection(item.eventId)}
                            />
                          </TableCell>
                          <TableCell className="font-medium">{item.eventName}</TableCell>
                          <TableCell>{format(parseISO(item.eventDate), 'MMM d, yyyy')}</TableCell>
                          <TableCell>{item.city || item.venueName || '-'}</TableCell>
                          <TableCell>
                            <Badge variant={item.assignmentCount === 0 ? 'destructive' : 'secondary'}>
                              {item.assignmentCount} assigned
                            </Badge>
                          </TableCell>
                          <TableCell>
                            <div className="flex flex-wrap gap-1">
                              {item.assignmentCount === 0 && (
                                <Badge variant="destructive" className="text-xs">No staff</Badge>
                              )}
                              {!item.hasLead && item.assignmentCount > 0 && (
                                <Badge variant="outline" className="text-xs border-amber-500 text-amber-700">No lead</Badge>
                              )}
                              {item.staffOnSameDay.length > 0 && (
                                <Badge variant="outline" className="text-xs">Multi-day</Badge>
                              )}
                            </div>
                          </TableCell>
                          <TableCell>
                            <Button asChild size="sm" variant="ghost">
                              <Link to={`/events/${item.eventId}`}>
                                <Eye className="h-4 w-4" />
                              </Link>
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Delivery Tab */}
        <TabsContent value="delivery" className="space-y-4">
          <div className="grid grid-cols-3 gap-4">
            <StatCard
              title="Due Next 7 Days"
              value={deliveryStats.dueNext7Days.length}
              icon={Clock}
              variant={deliveryStats.dueNext7Days.length > 0 ? 'warning' : 'default'}
            />
            <StatCard
              title="Overdue"
              value={deliveryStats.overdue.length}
              icon={AlertTriangle}
              variant={deliveryStats.overdue.length > 0 ? 'warning' : 'success'}
            />
            <StatCard
              title="Missing Link"
              value={deliveryStats.missingLink.length}
              icon={Truck}
              variant={deliveryStats.missingLink.length > 0 ? 'warning' : 'default'}
            />
          </div>

          <Card>
            <CardHeader>
              <CardTitle>Delivery Status</CardTitle>
              <CardDescription>Events requiring delivery attention</CardDescription>
            </CardHeader>
            <CardContent>
              {delivery.filter(d => d.isOverdue || (d.daysUntilDeadline !== null && d.daysUntilDeadline <= 7 && !d.deliveredAt)).length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <CheckCircle2 className="h-12 w-12 mx-auto mb-2 text-green-500" />
                  <p>No urgent delivery items</p>
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-10">
                        <Checkbox />
                      </TableHead>
                      <TableHead>Event</TableHead>
                      <TableHead>Event Date</TableHead>
                      <TableHead>Deadline</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {delivery
                      .filter(d => d.isOverdue || (d.daysUntilDeadline !== null && d.daysUntilDeadline <= 7 && !d.deliveredAt))
                      .sort((a, b) => (a.daysUntilDeadline || 999) - (b.daysUntilDeadline || 999))
                      .map(item => (
                        <TableRow key={item.eventId} className={item.isOverdue ? 'bg-destructive/5' : ''}>
                          <TableCell>
                            <Checkbox
                              checked={selectedEventIds.includes(item.eventId)}
                              onCheckedChange={() => handleToggleEventSelection(item.eventId)}
                            />
                          </TableCell>
                          <TableCell className="font-medium">{item.eventName}</TableCell>
                          <TableCell>{format(parseISO(item.eventDate), 'MMM d')}</TableCell>
                          <TableCell>
                            {item.deliveryDeadline 
                              ? format(parseISO(item.deliveryDeadline), 'MMM d')
                              : '-'
                            }
                          </TableCell>
                          <TableCell>
                            {item.isOverdue ? (
                              <Badge variant="destructive">
                                Overdue {Math.abs(item.daysUntilDeadline || 0)} days
                              </Badge>
                            ) : item.deliveredAt ? (
                              <Badge variant="outline" className="border-green-500 text-green-700">
                                <CheckCircle2 className="h-3 w-3 mr-1" />
                                Delivered
                              </Badge>
                            ) : !item.hasDeliveryLink ? (
                              <Badge variant="outline" className="border-amber-500 text-amber-700">
                                No link
                              </Badge>
                            ) : (
                              <Badge variant="secondary">
                                {item.daysUntilDeadline} days left
                              </Badge>
                            )}
                          </TableCell>
                          <TableCell>
                            <Button asChild size="sm" variant="ghost">
                              <Link to={`/events/${item.eventId}`}>
                                <ChevronRight className="h-4 w-4" />
                              </Link>
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Needs Attention Tab */}
        <TabsContent value="attention" className="space-y-4">
          <div className="flex items-center gap-4">
            <Label>Filter by issue:</Label>
            <Select value={needsAttentionFilter} onValueChange={setNeedsAttentionFilter}>
              <SelectTrigger className="w-48">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Issues</SelectItem>
                <SelectItem value="session">Missing Sessions</SelectItem>
                <SelectItem value="venue">Missing Venue</SelectItem>
                <SelectItem value="contact">Missing Contact</SelectItem>
                <SelectItem value="delivery">Missing Delivery</SelectItem>
                <SelectItem value="staff">No Staff</SelectItem>
                <SelectItem value="lead">Missing Lead</SelectItem>
              </SelectContent>
            </Select>
            
            {filteredNeedsAttention.length > 0 && (
              <Button 
                size="sm" 
                variant="outline"
                onClick={() => setSelectedEventIds(filteredNeedsAttention.map(i => i.eventId))}
              >
                Select All ({filteredNeedsAttention.length})
              </Button>
            )}
          </div>

          {filteredNeedsAttention.length === 0 ? (
            <Card>
              <CardContent className="py-12">
                <div className="text-center text-muted-foreground">
                  <CheckCircle2 className="h-12 w-12 mx-auto mb-2 text-green-500" />
                  <p>No events need attention</p>
                </div>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-3">
              {filteredNeedsAttention.map(item => (
                <Card 
                  key={item.eventId}
                  className={cn(
                    item.priority === 'high' && 'border-destructive/50 bg-destructive/5',
                    item.priority === 'medium' && 'border-amber-500/50 bg-amber-500/5'
                  )}
                >
                  <CardContent className="p-4">
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex items-start gap-3">
                        <Checkbox
                          checked={selectedEventIds.includes(item.eventId)}
                          onCheckedChange={() => handleToggleEventSelection(item.eventId)}
                          className="mt-1"
                        />
                        <div>
                          <div className="flex items-center gap-2 mb-1">
                            <h4 className="font-medium">{item.eventName}</h4>
                            <Badge variant={item.priority === 'high' ? 'destructive' : item.priority === 'medium' ? 'secondary' : 'outline'}>
                              {item.priority}
                            </Badge>
                          </div>
                          <p className="text-sm text-muted-foreground mb-2">
                            {format(parseISO(item.eventDate), 'EEEE, MMMM d, yyyy')}
                            {item.venueName && ` • ${item.venueName}`}
                          </p>
                          <div className="flex flex-wrap gap-1.5">
                            {item.issues.map((issue, i) => (
                              <Badge key={i} variant="outline" className="text-xs">
                                {issue}
                              </Badge>
                            ))}
                          </div>
                        </div>
                      </div>
                      <Button asChild variant="outline" size="sm">
                        <Link to={`/events/${item.eventId}`}>
                          View Event
                          <ChevronRight className="h-4 w-4 ml-1" />
                        </Link>
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>

        {/* Settings Tab */}
        <TabsContent value="settings" className="space-y-6">
          <div className="grid lg:grid-cols-2 gap-6">
            <Card>
              <CardHeader>
                <CardTitle>Series Defaults</CardTitle>
                <CardDescription>Settings applied to new events in this series</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
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
                  <Label>Deadline Days (after event)</Label>
                  <Input
                    type="number"
                    value={editDeadlineDays}
                    onChange={(e) => setEditDeadlineDays(e.target.value)}
                    min="1"
                    max="30"
                  />
                </div>

                <div className="space-y-3 rounded-lg border border-border bg-card/40 p-4">
                  <div className="space-y-1">
                    <Label>Default Event Times</Label>
                    <p className="text-sm text-muted-foreground">
                      Applied to newly created events in this series.
                    </p>
                  </div>
                  <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                    <div className="space-y-2">
                      <Label>Start Time</Label>
                      <Input
                        type="time"
                        value={editStartTime}
                        onChange={(e) => setEditStartTime(e.target.value)}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Finish Time</Label>
                      <Input
                        type="time"
                        value={editEndTime}
                        onChange={(e) => setEditEndTime(e.target.value)}
                      />
                    </div>
                  </div>
                </div>
                
                <div className="space-y-2">
                  <Label>Default City</Label>
                  <Input
                    value={editVenueCity}
                    onChange={(e) => setEditVenueCity(e.target.value)}
                    placeholder="e.g., Sydney"
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
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Default Notes</CardTitle>
                <CardDescription>Notes applied to events in this series</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label>Public Notes (visible to photographers)</Label>
                  <Textarea
                    value={editNotesPublic}
                    onChange={(e) => setEditNotesPublic(e.target.value)}
                    rows={3}
                    placeholder="General notes visible to all staff..."
                  />
                </div>
                
                <div className="space-y-2">
                  <Label>Internal Notes (admin only)</Label>
                  <Textarea
                    value={editNotesInternal}
                    onChange={(e) => setEditNotesInternal(e.target.value)}
                    rows={3}
                    placeholder="Private admin notes..."
                  />
                </div>
                
                <div className="space-y-2">
                  <Label>Series Notes</Label>
                  <Textarea
                    value={editNotes}
                    onChange={(e) => setEditNotes(e.target.value)}
                    rows={2}
                    placeholder="General series notes..."
                  />
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>

      {/* Dialogs */}
      <BulkEventCreationDialog
        open={bulkCreateOpen}
        onOpenChange={setBulkCreateOpen}
        series={series}
      />
      
      <RecommendCrewDialog
        open={recommendCrewOpen}
        onOpenChange={setRecommendCrewOpen}
        eventIds={unassignedEventIds}
        scope="series"
        seriesDefaults={series.default_roles_json as any}
      />
      
      {bulkActionType && (
        <SeriesBulkActionsDialog
          open={!!bulkActionType}
          onOpenChange={(open) => !open && setBulkActionType(null)}
          actionType={bulkActionType}
          selectedEventIds={selectedEventIds}
          onComplete={() => setSelectedEventIds([])}
        />
      )}
      
      <BulkAssignmentDialog
        open={bulkAssignOpen}
        onOpenChange={setBulkAssignOpen}
        selectedEvents={events.filter(e => selectedEventIds.includes(e.id)).map(e => ({
          id: e.id,
          event_name: e.event_name,
          client_name: e.client_name,
          event_date: e.event_date,
          arrival_time: null, // Series events don't have session-level arrival_time
          start_time: e.start_time,
          end_time: e.end_time,
          start_at: e.start_at,
          end_at: e.end_at,
          timezone: null, // Series events don't expose timezone yet
          venue_name: e.venue_name,
          venue_address: e.venue_address,
          onsite_contact_name: null,
          onsite_contact_phone: null,
          event_type_id: e.event_type_id,
          event_series_id: e.event_series_id,
          event_series_name: null,
          delivery_method_id: e.delivery_method_id,
          delivery_deadline: e.delivery_deadline,
          assignment_count: 0,
          has_conflict: false,
          needs_attention: false,
          is_delivered: false,
        }))}
        onComplete={() => {
          setSelectedEventIds([]);
          setBulkAssignOpen(false);
        }}
      />
    </AppLayout>
  );
}
