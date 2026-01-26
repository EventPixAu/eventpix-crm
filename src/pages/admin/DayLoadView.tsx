import { useState, useMemo } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { format, parseISO, addDays, subDays, isToday, differenceInDays } from 'date-fns';
import {
  Calendar,
  ChevronLeft,
  ChevronRight,
  Clock,
  MapPin,
  Users,
  AlertTriangle,
  AlertCircle,
  CheckCircle,
  XCircle,
  Package,
  ExternalLink,
  Filter,
  Layers,
  User,
  UserX,
  Truck,
  Phone,
  Loader2,
} from 'lucide-react';
import { AppLayout } from '@/components/layout/AppLayout';
import { PageHeader } from '@/components/layout/PageHeader';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar as CalendarPicker } from '@/components/ui/calendar';
import { useDayLoadEvents, useDayLoadSummary, useDayLoadFilterOptions, type DayLoadEvent, type DayLoadAssignment } from '@/hooks/useDayLoad';
import { BulkAssignmentDialog } from '@/components/BulkAssignmentDialog';
import { EscalationBannersCompact } from '@/components/EscalationBanners';
import { useAuth } from '@/lib/auth';
import { cn } from '@/lib/utils';

function ReadinessBadge({ event }: { event: DayLoadEvent }) {
  const issues: string[] = [];
  if (!event.has_staff) issues.push('No staff');
  if (!event.has_sessions) issues.push('No sessions');
  if (!event.has_venue) issues.push('No venue');
  if (!event.has_delivery_method) issues.push('No delivery method');

  const status = issues.length === 0 ? 'ready' : issues.length <= 2 ? 'partial' : 'not_ready';

  const config = {
    ready: { label: 'Ready', icon: CheckCircle, className: 'bg-green-500/20 text-green-700 border-green-500/50' },
    partial: { label: 'Partial', icon: AlertCircle, className: 'bg-amber-500/20 text-amber-700 border-amber-500/50' },
    not_ready: { label: 'Not Ready', icon: XCircle, className: 'bg-destructive/20 text-destructive border-destructive/50' },
  };

  const { label, icon: Icon, className } = config[status];

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <Badge variant="outline" className={cn('gap-1 border', className)}>
            <Icon className="h-3 w-3" />
            {label}
          </Badge>
        </TooltipTrigger>
        {issues.length > 0 && (
          <TooltipContent side="bottom">
            <ul className="text-xs space-y-0.5">
              {issues.map((issue, i) => (
                <li key={i} className="flex items-center gap-1">
                  <XCircle className="h-3 w-3 text-destructive" />
                  {issue}
                </li>
              ))}
            </ul>
          </TooltipContent>
        )}
      </Tooltip>
    </TooltipProvider>
  );
}

function StaffChip({ assignment }: { assignment: DayLoadAssignment }) {
  const hasConflict = assignment.has_hard_conflict || assignment.has_soft_conflict;

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <div
            className={cn(
              'inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs',
              assignment.has_hard_conflict
                ? 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400'
                : assignment.has_soft_conflict
                ? 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400'
                : 'bg-muted text-foreground'
            )}
          >
            <User className="h-3 w-3" />
            <span className="truncate max-w-[80px]">
              {assignment.user_name?.split(' ')[0] || 'Unknown'}
            </span>
            {assignment.role_name && (
              <span className="text-muted-foreground">({assignment.role_name})</span>
            )}
            {hasConflict && <AlertTriangle className="h-3 w-3 shrink-0" />}
          </div>
        </TooltipTrigger>
        <TooltipContent side="bottom" className="max-w-xs">
          <p className="font-medium">{assignment.user_name || 'Unknown'}</p>
          {assignment.role_name && (
            <p className="text-xs text-muted-foreground">{assignment.role_name}</p>
          )}
          {assignment.conflict_details.length > 0 && (
            <ul className="text-xs mt-1 space-y-0.5">
              {assignment.conflict_details.map((detail, i) => (
                <li key={i} className="flex items-center gap-1 text-amber-600 dark:text-amber-400">
                  <AlertTriangle className="h-3 w-3 shrink-0" />
                  {detail}
                </li>
              ))}
            </ul>
          )}
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

function OperationalSignals({ event }: { event: DayLoadEvent }) {
  const signals: { icon: typeof Package; label: string; status: 'ok' | 'warning' | 'error' }[] = [];

  // Equipment
  if (event.recommended_kit_id) {
    signals.push({
      icon: Package,
      label: event.equipment_allocated
        ? event.equipment_picked_up
          ? 'Equipment picked up'
          : 'Equipment allocated'
        : 'Equipment not allocated',
      status: event.equipment_allocated ? (event.equipment_picked_up ? 'ok' : 'warning') : 'error',
    });
  }

  // Contacts
  signals.push({
    icon: Phone,
    label: event.has_contacts ? 'Contacts set' : 'Missing contacts',
    status: event.has_contacts ? 'ok' : 'warning',
  });

  // Sessions
  signals.push({
    icon: Clock,
    label: event.has_sessions ? 'Sessions defined' : 'Missing sessions',
    status: event.has_sessions ? 'ok' : 'error',
  });

  // Delivery method
  signals.push({
    icon: Truck,
    label: event.has_delivery_method ? 'Delivery set' : 'Missing delivery',
    status: event.has_delivery_method ? 'ok' : 'error',
  });

  const statusColors = {
    ok: 'text-green-600',
    warning: 'text-amber-600',
    error: 'text-destructive',
  };

  return (
    <div className="flex flex-wrap gap-2">
      {signals.map((signal, i) => (
        <TooltipProvider key={i}>
          <Tooltip>
            <TooltipTrigger asChild>
              <signal.icon className={cn('h-4 w-4', statusColors[signal.status])} />
            </TooltipTrigger>
            <TooltipContent>{signal.label}</TooltipContent>
          </Tooltip>
        </TooltipProvider>
      ))}
    </div>
  );
}

export default function DayLoadView() {
  const [searchParams, setSearchParams] = useSearchParams();
  const { isAdmin } = useAuth();

  // Filters
  const dateParam = searchParams.get('date');
  const selectedDate = dateParam ? parseISO(dateParam) : new Date();
  const dateStr = format(selectedDate, 'yyyy-MM-dd');

  const [eventSeriesId, setEventSeriesId] = useState<string>('');
  const [city, setCity] = useState<string>('');
  const [eventTypeId, setEventTypeId] = useState<string>('');
  const [showWarningsOnly, setShowWarningsOnly] = useState(false);

  // Bulk selection
  const [selectedEventIds, setSelectedEventIds] = useState<Set<string>>(new Set());
  const [bulkAssignDialogOpen, setBulkAssignDialogOpen] = useState(false);

  // Data
  const { data: events = [], isLoading, refetch } = useDayLoadEvents({
    date: dateStr,
    eventSeriesId: eventSeriesId || undefined,
    city: city || undefined,
    eventTypeId: eventTypeId || undefined,
    showWarningsOnly,
  });
  const summary = useDayLoadSummary(events);
  const { eventSeries, eventTypes, cities, isLoading: filtersLoading } = useDayLoadFilterOptions();

  // Navigation
  const navigateDay = (direction: 'prev' | 'next') => {
    const newDate = direction === 'prev' ? subDays(selectedDate, 1) : addDays(selectedDate, 1);
    setSearchParams({ date: format(newDate, 'yyyy-MM-dd') });
    setSelectedEventIds(new Set());
  };

  const goToToday = () => {
    setSearchParams({ date: format(new Date(), 'yyyy-MM-dd') });
  };

  const handleDateSelect = (date: Date | undefined) => {
    if (date) {
      setSearchParams({ date: format(date, 'yyyy-MM-dd') });
    }
  };

  // Selection
  const toggleEventSelection = (eventId: string) => {
    setSelectedEventIds(prev => {
      const newSet = new Set(prev);
      if (newSet.has(eventId)) {
        newSet.delete(eventId);
      } else {
        newSet.add(eventId);
      }
      return newSet;
    });
  };

  const selectAllEvents = () => {
    setSelectedEventIds(new Set(events.map(e => e.id)));
  };

  const clearSelection = () => {
    setSelectedEventIds(new Set());
  };

  // Get selected events for bulk dialog
  const selectedEvents = useMemo(() => {
    return events
      .filter(e => selectedEventIds.has(e.id))
      .map(e => ({
        id: e.id,
        event_name: e.event_name,
        event_date: e.event_date,
        start_at: e.start_at,
        end_at: e.end_at,
        arrival_time: null, // DayLoad events don't have session-level arrival_time
        start_time: e.start_time,
        end_time: e.end_time,
        client_name: e.client_name,
        venue_name: e.venue_name,
        venue_address: e.venue_address,
        event_type_id: e.event_type_id,
        event_series_id: e.event_series_id,
        event_series_name: e.event_series_name,
        delivery_method_id: e.delivery_method_id,
        delivery_deadline: e.delivery_deadline,
        assignment_count: e.assignment_count,
        has_conflict: e.assignments.some(a => a.has_hard_conflict),
        needs_attention: e.guardrail_warning_count > 0,
        is_delivered: false,
        onsite_contact_name: null,
        onsite_contact_phone: null,
      }));
  }, [events, selectedEventIds]);

  const handleBulkComplete = () => {
    clearSelection();
    refetch();
  };

  // Format delivery deadline
  const formatDeadline = (deadline: string | null) => {
    if (!deadline) return null;
    const days = differenceInDays(parseISO(deadline), new Date());
    if (days < 0) return { text: 'Overdue', className: 'text-destructive' };
    if (days === 0) return { text: 'Today', className: 'text-amber-600' };
    if (days === 1) return { text: 'Tomorrow', className: 'text-amber-600' };
    return { text: `${days}d`, className: 'text-muted-foreground' };
  };

  // Extract suburb from address
  const getSuburb = (address: string | null) => {
    if (!address) return null;
    const parts = address.split(',').map(p => p.trim());
    return parts.length >= 2 ? parts[parts.length - 2] : parts[0];
  };

  if (!isAdmin) {
    return (
      <AppLayout>
        <div className="flex items-center justify-center h-64">
          <p className="text-muted-foreground">Access denied. Admin only.</p>
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <PageHeader
        title="Day Load View"
        description="Multi-event day management and conflict control"
        actions={
          <Link to="/calendar">
            <Button variant="outline">
              <Calendar className="h-4 w-4 mr-2" />
              Calendar
            </Button>
          </Link>
        }
      />

      {/* Date Navigation */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 mb-6">
        <div className="flex items-center gap-2">
          <Button variant="outline" size="icon" onClick={() => navigateDay('prev')}>
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <Popover>
            <PopoverTrigger asChild>
              <Button variant="outline" className="min-w-[220px] justify-start">
                <Calendar className="h-4 w-4 mr-2" />
                {format(selectedDate, 'EEEE, MMMM d, yyyy')}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="start">
              <CalendarPicker
                mode="single"
                selected={selectedDate}
                onSelect={handleDateSelect}
                initialFocus
              />
            </PopoverContent>
          </Popover>
          <Button variant="outline" size="icon" onClick={() => navigateDay('next')}>
            <ChevronRight className="h-4 w-4" />
          </Button>
          {!isToday(selectedDate) && (
            <Button variant="outline" onClick={goToToday}>
              Today
            </Button>
          )}
        </div>

        {/* Bulk Actions */}
        {selectedEventIds.size > 0 && (
          <div className="flex items-center gap-2 bg-primary/10 rounded-lg px-3 py-1.5">
            <span className="text-sm font-medium">{selectedEventIds.size} selected</span>
            <Button variant="ghost" size="sm" onClick={selectAllEvents}>
              Select All
            </Button>
            <Button variant="ghost" size="sm" onClick={clearSelection}>
              Clear
            </Button>
            <Button size="sm" onClick={() => setBulkAssignDialogOpen(true)}>
              <Users className="h-4 w-4 mr-1" />
              Bulk Assign
            </Button>
          </div>
        )}
      </div>

      {/* Filters */}
      <Card className="mb-6">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm flex items-center gap-2">
            <Filter className="h-4 w-4" />
            Filters
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-4">
            <div className="w-48">
              <Label className="text-xs mb-1 block">Event Series</Label>
              <Select value={eventSeriesId || "all"} onValueChange={(val) => setEventSeriesId(val === "all" ? "" : val)}>
                <SelectTrigger>
                  <SelectValue placeholder="All series" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All series</SelectItem>
                  {eventSeries.map(s => (
                    <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="w-48">
              <Label className="text-xs mb-1 block">City</Label>
              <Select value={city || "all"} onValueChange={(val) => setCity(val === "all" ? "" : val)}>
                <SelectTrigger>
                  <SelectValue placeholder="All cities" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All cities</SelectItem>
                  {cities.map(c => (
                    <SelectItem key={c} value={c}>{c}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="w-48">
              <Label className="text-xs mb-1 block">Event Type</Label>
              <Select value={eventTypeId || "all"} onValueChange={(val) => setEventTypeId(val === "all" ? "" : val)}>
                <SelectTrigger>
                  <SelectValue placeholder="All types" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All types</SelectItem>
                  {eventTypes.map(t => (
                    <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex items-end">
              <div className="flex items-center gap-2">
                <Checkbox
                  id="warnings-only"
                  checked={showWarningsOnly}
                  onCheckedChange={(checked) => setShowWarningsOnly(!!checked)}
                />
                <Label htmlFor="warnings-only" className="text-sm cursor-pointer">
                  Show warnings only
                </Label>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-8 gap-4 mb-6">
        <Card>
          <CardContent className="pt-4">
            <div className="text-2xl font-bold">{summary.totalEvents}</div>
            <p className="text-xs text-muted-foreground">Events Today</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <div className="text-2xl font-bold text-primary">{summary.totalCrewAssigned}</div>
            <p className="text-xs text-muted-foreground">Crew Assigned</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <div className="text-2xl font-bold">{summary.totalSessions}</div>
            <p className="text-xs text-muted-foreground">Total Sessions</p>
          </CardContent>
        </Card>
        <Card className={summary.eventsWithWarnings > 0 ? 'border-amber-500/50' : ''}>
          <CardContent className="pt-4">
            <div className="text-2xl font-bold text-amber-600">{summary.eventsWithWarnings}</div>
            <p className="text-xs text-muted-foreground">With Warnings</p>
          </CardContent>
        </Card>
        <Card className={summary.eventsWithConflicts > 0 ? 'border-destructive/50' : ''}>
          <CardContent className="pt-4">
            <div className="text-2xl font-bold text-destructive">{summary.eventsWithConflicts}</div>
            <p className="text-xs text-muted-foreground">Staff Conflicts</p>
          </CardContent>
        </Card>
        <Card className={summary.eventsWithNoLead > 0 ? 'border-amber-500/50' : ''}>
          <CardContent className="pt-4">
            <div className="text-2xl font-bold">{summary.eventsWithNoLead}</div>
            <p className="text-xs text-muted-foreground">No Lead Assigned</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <div className="text-2xl font-bold">{summary.staffWithMultipleEvents}</div>
            <p className="text-xs text-muted-foreground">Staff Multi-Booked</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <div className="text-2xl font-bold">{summary.eventsWithStaff}/{summary.totalEvents}</div>
            <p className="text-xs text-muted-foreground">Staffed</p>
          </CardContent>
        </Card>
      </div>

      {/* Events Grid */}
      {isLoading ? (
        <div className="flex items-center justify-center h-64">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      ) : events.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <Calendar className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
            <h3 className="text-lg font-medium mb-1">No events on this date</h3>
            <p className="text-muted-foreground">
              {showWarningsOnly ? 'No events with warnings found.' : 'Select a different date to view events.'}
            </p>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-10">
                  <Checkbox
                    checked={selectedEventIds.size === events.length && events.length > 0}
                    onCheckedChange={(checked) => {
                      if (checked) selectAllEvents();
                      else clearSelection();
                    }}
                  />
                </TableHead>
                <TableHead>Time</TableHead>
                <TableHead>Event</TableHead>
                <TableHead>Venue</TableHead>
                <TableHead>Type / Series</TableHead>
                <TableHead>Delivery</TableHead>
                <TableHead>Readiness</TableHead>
                <TableHead>Warnings</TableHead>
                <TableHead>Staff</TableHead>
                <TableHead>Signals</TableHead>
                <TableHead className="w-10"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {events.map((event) => {
                const deadline = formatDeadline(event.delivery_deadline);
                const suburb = getSuburb(event.venue_address) || event.venue_name;
                const isSelected = selectedEventIds.has(event.id);

                return (
                  <TableRow
                    key={event.id}
                    className={cn(
                      isSelected && 'bg-primary/5',
                      event.guardrail_warning_count > 0 && 'bg-amber-50/50 dark:bg-amber-900/10'
                    )}
                  >
                    <TableCell>
                      <Checkbox
                        checked={isSelected}
                        onCheckedChange={() => toggleEventSelection(event.id)}
                      />
                    </TableCell>
                    <TableCell className="whitespace-nowrap">
                      <div className="flex items-center gap-1 text-sm">
                        <Clock className="h-3 w-3 text-muted-foreground" />
                        {event.start_time
                          ? format(new Date(`2000-01-01T${event.start_time}`), 'h:mm a')
                          : '–'}
                        {event.end_time && (
                          <span className="text-muted-foreground">
                            –{format(new Date(`2000-01-01T${event.end_time}`), 'h:mm a')}
                          </span>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      <div>
                        <Link
                          to={`/events/${event.id}`}
                          className="font-medium hover:underline"
                        >
                          {event.event_name}
                        </Link>
                        <p className="text-xs text-muted-foreground">{event.client_name}</p>
                      </div>
                    </TableCell>
                    <TableCell>
                      {suburb && (
                        <div className="flex items-center gap-1 text-sm">
                          <MapPin className="h-3 w-3 text-muted-foreground" />
                          {suburb}
                        </div>
                      )}
                    </TableCell>
                    <TableCell>
                      <div className="space-y-1">
                        {event.event_type_name && (
                          <Badge variant="outline" className="text-xs">
                            {event.event_type_name}
                          </Badge>
                        )}
                        {event.event_series_name && (
                          <Badge variant="secondary" className="text-xs flex items-center gap-1 w-fit">
                            <Layers className="h-3 w-3" />
                            {event.event_series_name}
                          </Badge>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      {deadline && (
                        <span className={cn('text-sm', deadline.className)}>
                          {deadline.text}
                        </span>
                      )}
                    </TableCell>
                    <TableCell>
                      <ReadinessBadge event={event} />
                    </TableCell>
                    <TableCell>
                      {event.guardrail_warning_count > 0 ? (
                        <Badge variant="outline" className="bg-amber-500/20 text-amber-700 border-amber-500/50">
                          <AlertTriangle className="h-3 w-3 mr-1" />
                          {event.guardrail_warning_count}
                        </Badge>
                      ) : (
                        <span className="text-muted-foreground text-sm">–</span>
                      )}
                    </TableCell>
                    <TableCell>
                      {event.assignments.length > 0 ? (
                        <div className="flex flex-wrap gap-1 max-w-[200px]">
                          {event.assignments.slice(0, 3).map((assignment) => (
                            <StaffChip key={assignment.id} assignment={assignment} />
                          ))}
                          {event.assignments.length > 3 && (
                            <Badge variant="outline" className="text-xs">
                              +{event.assignments.length - 3}
                            </Badge>
                          )}
                        </div>
                      ) : (
                        <span className="text-muted-foreground text-sm italic flex items-center gap-1">
                          <UserX className="h-3 w-3" />
                          No staff
                        </span>
                      )}
                    </TableCell>
                    <TableCell>
                      <OperationalSignals event={event} />
                    </TableCell>
                    <TableCell>
                      <Link to={`/events/${event.id}`}>
                        <Button variant="ghost" size="icon" className="h-8 w-8">
                          <ExternalLink className="h-4 w-4" />
                        </Button>
                      </Link>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </Card>
      )}

      {/* Bulk Assignment Dialog */}
      <BulkAssignmentDialog
        open={bulkAssignDialogOpen}
        onOpenChange={setBulkAssignDialogOpen}
        selectedEvents={selectedEvents}
        onComplete={handleBulkComplete}
      />
    </AppLayout>
  );
}
