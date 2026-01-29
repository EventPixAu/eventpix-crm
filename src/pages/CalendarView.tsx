import { useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  format,
  startOfMonth,
  endOfMonth,
  eachDayOfInterval,
  isSameMonth,
  isToday,
  addMonths,
  subMonths,
  startOfWeek,
  endOfWeek,
  addWeeks,
  subWeeks,
} from 'date-fns';
import { motion } from 'framer-motion';
import { 
  ChevronLeft, 
  ChevronRight, 
  Clock, 
  MapPin, 
  AlertTriangle, 
  Users,
  Calendar,
  List,
  LayoutGrid,
  Layers,
  Eye,
  Globe,
} from 'lucide-react';
import { CalendarSubscribeDialog } from '@/components/CalendarSubscribeDialog';
import { AppLayout } from '@/components/layout/AppLayout';
import { PageHeader } from '@/components/layout/PageHeader';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  ToggleGroup,
  ToggleGroupItem,
} from '@/components/ui/toggle-group';
import { useStaffDirectory } from '@/hooks/useStaff';
import { useEventTypes, useDeliveryMethods } from '@/hooks/useLookups';
import { useActiveEventSeries } from '@/hooks/useEventSeries';
import { useAdminCalendarEvents, useCalendarLeads, getVenueSuburb, type CalendarEvent, type CalendarLead } from '@/hooks/useCalendar';
import { getTimezoneAbbr } from '@/lib/timezones';
import { cn } from '@/lib/utils';

type ViewMode = 'month' | 'week' | 'list';

// Generate consistent colors for series based on their ID
const SERIES_COLORS = [
  { bg: 'bg-blue-500/20', border: 'border-blue-500', text: 'text-blue-400' },
  { bg: 'bg-emerald-500/20', border: 'border-emerald-500', text: 'text-emerald-400' },
  { bg: 'bg-purple-500/20', border: 'border-purple-500', text: 'text-purple-400' },
  { bg: 'bg-amber-500/20', border: 'border-amber-500', text: 'text-amber-400' },
  { bg: 'bg-pink-500/20', border: 'border-pink-500', text: 'text-pink-400' },
  { bg: 'bg-cyan-500/20', border: 'border-cyan-500', text: 'text-cyan-400' },
  { bg: 'bg-rose-500/20', border: 'border-rose-500', text: 'text-rose-400' },
  { bg: 'bg-indigo-500/20', border: 'border-indigo-500', text: 'text-indigo-400' },
];

function getSeriesColor(seriesId: string | null, seriesColorMap: Map<string, number>) {
  if (!seriesId) return null;
  const colorIndex = seriesColorMap.get(seriesId) ?? 0;
  return SERIES_COLORS[colorIndex % SERIES_COLORS.length];
}

function EventTile({ event, seriesColorMap }: { event: CalendarEvent; seriesColorMap: Map<string, number> }) {
  const suburb = getVenueSuburb(event.venue_address) || event.venue_name;
  const seriesColor = getSeriesColor(event.event_series_id, seriesColorMap);
  const tzAbbr = event.timezone && event.timezone !== 'Australia/Sydney' 
    ? getTimezoneAbbr(event.timezone) 
    : null;
  
  return (
    <Link
      to={`/events/${event.id}`}
      className={cn(
        "block text-xs p-1.5 rounded transition-colors truncate border-l-2",
        event.has_conflict 
          ? "bg-orange-100 dark:bg-orange-900/30 border-orange-500 hover:bg-orange-200 dark:hover:bg-orange-900/50"
          : event.needs_attention
          ? "bg-amber-100 dark:bg-amber-900/30 border-amber-500 hover:bg-amber-200 dark:hover:bg-amber-900/50"
          : seriesColor
          ? `${seriesColor.bg} ${seriesColor.border} hover:opacity-80`
          : "bg-amber-50 dark:bg-amber-100 border-primary hover:bg-amber-100 dark:hover:bg-amber-200"
      )}
    >
      <div className="flex items-center gap-1">
        {(event.arrival_time || event.start_time) && (
          <span className={cn(
            "font-medium shrink-0",
            seriesColor ? seriesColor.text : "text-amber-700"
          )}>
            {format(new Date(`2000-01-01T${event.arrival_time || event.start_time}`), 'h:mm a')}
          </span>
        )}
        {tzAbbr && (
          <span className="text-[10px] text-gray-600 shrink-0">({tzAbbr})</span>
        )}
        {event.has_conflict && (
          <AlertTriangle className="h-3 w-3 text-orange-600 shrink-0" />
        )}
        {event.needs_attention && !event.has_conflict && (
          <Clock className="h-3 w-3 text-amber-600 shrink-0" />
        )}
      </div>
      <span className="text-gray-900 block truncate font-medium">{event.event_name}</span>
      <div className="flex items-center gap-1 text-gray-600">
        {suburb && (
          <span className="truncate">{suburb}</span>
        )}
        {event.assignment_count > 0 && (
          <span className="flex items-center gap-0.5 shrink-0">
            <Users className="h-2.5 w-2.5" />
            {event.assignment_count}
          </span>
        )}
      </div>
    </Link>
  );
}

function LeadTile({ lead }: { lead: CalendarLead }) {
  return (
    <Link
      to={`/sales/leads/${lead.id}`}
      className="block text-xs p-1.5 rounded transition-colors truncate border-l-2 bg-violet-100 dark:bg-violet-200 border-violet-500 hover:bg-violet-200 dark:hover:bg-violet-300"
    >
      <div className="flex items-center gap-1">
        <span className="text-[10px] font-medium text-violet-700 uppercase shrink-0">Lead</span>
      </div>
      <span className="text-gray-900 block truncate font-medium">{lead.lead_name}</span>
      <div className="text-gray-600 truncate">
        {lead.client_name}
      </div>
    </Link>
  );
}

function ListViewItem({ event, seriesColorMap }: { event: CalendarEvent; seriesColorMap: Map<string, number> }) {
  const suburb = getVenueSuburb(event.venue_address) || event.venue_name;
  const seriesColor = getSeriesColor(event.event_series_id, seriesColorMap);
  const tzAbbr = event.timezone && event.timezone !== 'Australia/Sydney' 
    ? getTimezoneAbbr(event.timezone) 
    : null;
  
  return (
    <Link
      to={`/events/${event.id}`}
      className={cn(
        "flex items-center gap-4 p-4 rounded-lg border transition-colors",
        event.has_conflict
          ? "border-orange-300 bg-orange-50 dark:bg-orange-900/20 hover:bg-orange-100 dark:hover:bg-orange-900/30"
          : event.needs_attention
          ? "border-amber-300 bg-amber-50 dark:bg-amber-900/20 hover:bg-amber-100 dark:hover:bg-amber-900/30"
          : seriesColor
          ? `${seriesColor.border} ${seriesColor.bg} hover:opacity-80`
          : "border-border bg-card hover:bg-muted/50"
      )}
    >
      <div className="text-center shrink-0 w-16">
        <p className={cn(
          "text-2xl font-bold",
          seriesColor ? seriesColor.text : "text-primary"
        )}>
          {format(new Date(event.event_date), 'd')}
        </p>
        <p className="text-xs text-muted-foreground uppercase">{format(new Date(event.event_date), 'EEE')}</p>
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <h3 className="font-medium truncate">{event.event_name}</h3>
          {tzAbbr && (
            <Badge variant="outline" className="text-muted-foreground shrink-0">
              <Globe className="h-3 w-3 mr-1" />
              {tzAbbr}
            </Badge>
          )}
          {event.event_series_name && (
            <Badge variant="outline" className={cn(
              "shrink-0",
              seriesColor ? `${seriesColor.border} ${seriesColor.text}` : ""
            )}>
              <Layers className="h-3 w-3 mr-1" />
              {event.event_series_name}
            </Badge>
          )}
          {event.has_conflict && (
            <Badge variant="outline" className="text-orange-600 border-orange-300 shrink-0">
              <AlertTriangle className="h-3 w-3 mr-1" />
              Conflict
            </Badge>
          )}
          {event.needs_attention && !event.has_conflict && (
            <Badge variant="outline" className="text-amber-600 border-amber-300 shrink-0">
              <Clock className="h-3 w-3 mr-1" />
              Due Soon
            </Badge>
          )}
        </div>
        <p className="text-sm text-muted-foreground">{event.client_name}</p>
        <div className="flex items-center gap-3 mt-1 text-xs text-muted-foreground">
          {(event.arrival_time || event.start_time) && (
            <span className="flex items-center gap-1">
              <Clock className="h-3 w-3" />
              {event.arrival_time ? `Call: ${format(new Date(`2000-01-01T${event.arrival_time}`), 'h:mm a')}` : ''}
              {event.start_time && ` Event: ${format(new Date(`2000-01-01T${event.start_time}`), 'h:mm a')}`}
              {event.end_time && ` - ${format(new Date(`2000-01-01T${event.end_time}`), 'h:mm a')}`}
              {tzAbbr && ` (${tzAbbr})`}
            </span>
          )}
          {suburb && (
            <span className="flex items-center gap-1 truncate">
              <MapPin className="h-3 w-3 shrink-0" />
              {suburb}
            </span>
          )}
        </div>
      </div>
      <div className="flex items-center gap-2 text-muted-foreground shrink-0">
        <Users className="h-4 w-4" />
        <span className="text-sm">{event.assignment_count}</span>
      </div>
    </Link>
  );
}

function DaySummaryBadge({ events }: { events: CalendarEvent[] }) {
  if (events.length <= 3) return null;
  
  // Group by series
  const seriesGroups = new Map<string, number>();
  events.forEach(e => {
    if (e.event_series_name) {
      seriesGroups.set(e.event_series_name, (seriesGroups.get(e.event_series_name) || 0) + 1);
    }
  });
  
  const topSeries = Array.from(seriesGroups.entries())
    .sort((a, b) => b[1] - a[1])[0];
  
  if (topSeries && topSeries[1] >= 2) {
    return (
      <div className="text-xs text-muted-foreground pl-1.5 flex items-center gap-1">
        <Layers className="h-3 w-3" />
        {topSeries[1]} {topSeries[0]}
      </div>
    );
  }
  
  return null;
}

export default function CalendarView() {
  const navigate = useNavigate();
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [currentWeek, setCurrentWeek] = useState(new Date());
  const [viewMode, setViewMode] = useState<ViewMode>('month');
  const [selectedStaff, setSelectedStaff] = useState('all');
  const [selectedEventType, setSelectedEventType] = useState('all');
  const [selectedDeliveryMethod, setSelectedDeliveryMethod] = useState('all');
  const [selectedSeries, setSelectedSeries] = useState('all');
  
  const { data: staffProfiles = [] } = useStaffDirectory();
  const { data: eventTypes = [] } = useEventTypes();
  const { data: deliveryMethods = [] } = useDeliveryMethods();
  const { data: eventSeries = [] } = useActiveEventSeries();
  
  const { data: events = [], isLoading } = useAdminCalendarEvents(currentMonth, {
    staffId: selectedStaff !== 'all' ? selectedStaff : undefined,
    eventTypeId: selectedEventType !== 'all' ? selectedEventType : undefined,
    deliveryMethodId: selectedDeliveryMethod !== 'all' ? selectedDeliveryMethod : undefined,
    seriesId: selectedSeries !== 'all' ? selectedSeries : undefined,
  });
  
  const { data: leads = [] } = useCalendarLeads(currentMonth);

  // Create consistent color mapping for series
  const seriesColorMap = useMemo(() => {
    const map = new Map<string, number>();
    const uniqueSeriesIds = [...new Set(events.map(e => e.event_series_id).filter(Boolean))];
    uniqueSeriesIds.forEach((id, index) => {
      if (id) map.set(id, index);
    });
    return map;
  }, [events]);

  const monthDays = useMemo(() => {
    const start = startOfMonth(currentMonth);
    const end = endOfMonth(currentMonth);
    return eachDayOfInterval({ start, end });
  }, [currentMonth]);

  const weekDays = useMemo(() => {
    const start = startOfWeek(currentWeek, { weekStartsOn: 0 });
    const end = endOfWeek(currentWeek, { weekStartsOn: 0 });
    return eachDayOfInterval({ start, end });
  }, [currentWeek]);

  const eventsByDate = useMemo(() => {
    const map = new Map<string, CalendarEvent[]>();
    events.forEach((event) => {
      const dateKey = event.event_date;
      if (!map.has(dateKey)) {
        map.set(dateKey, []);
      }
      map.get(dateKey)!.push(event);
    });
    // Sort each day's events by start_time
    map.forEach((dayEvents) => {
      dayEvents.sort((a, b) => {
        if (!a.start_time) return 1;
        if (!b.start_time) return -1;
        return a.start_time.localeCompare(b.start_time);
      });
    });
    return map;
  }, [events]);

  const leadsByDate = useMemo(() => {
    const map = new Map<string, CalendarLead[]>();
    leads.forEach((lead) => {
      const dateKey = lead.estimated_date;
      if (!map.has(dateKey)) {
        map.set(dateKey, []);
      }
      map.get(dateKey)!.push(lead);
    });
    return map;
  }, [leads]);

  const getEventsForDay = (day: Date) => {
    const dateKey = format(day, 'yyyy-MM-dd');
    return eventsByDate.get(dateKey) || [];
  };

  const getLeadsForDay = (day: Date) => {
    const dateKey = format(day, 'yyyy-MM-dd');
    return leadsByDate.get(dateKey) || [];
  };

  const sortedListEvents = useMemo(() => {
    return [...events].sort((a, b) => {
      const dateCompare = a.event_date.localeCompare(b.event_date);
      if (dateCompare !== 0) return dateCompare;
      if (!a.start_time) return 1;
      if (!b.start_time) return -1;
      return a.start_time.localeCompare(b.start_time);
    });
  }, [events]);

  // Check for busy days (5+ events)
  const busyDayCount = useMemo(() => {
    let count = 0;
    eventsByDate.forEach((dayEvents) => {
      if (dayEvents.length >= 5) count++;
    });
    return count;
  }, [eventsByDate]);

  const startDayOfWeek = startOfMonth(currentMonth).getDay();

  const handlePrev = () => {
    if (viewMode === 'week') {
      setCurrentWeek(subWeeks(currentWeek, 1));
    } else {
      setCurrentMonth(subMonths(currentMonth, 1));
    }
  };

  const handleNext = () => {
    if (viewMode === 'week') {
      setCurrentWeek(addWeeks(currentWeek, 1));
    } else {
      setCurrentMonth(addMonths(currentMonth, 1));
    }
  };

  const handleToday = () => {
    setCurrentMonth(new Date());
    setCurrentWeek(new Date());
  };

  return (
    <AppLayout>
      <PageHeader
        title="Calendar"
        description="View and manage all scheduled events"
      />

      {/* Busy day indicator */}
      {busyDayCount > 0 && (
        <div className="mb-4 p-3 bg-primary/10 border border-primary/20 rounded-lg flex items-center gap-2 text-sm">
          <Calendar className="h-4 w-4 text-primary" />
          <span>
            <strong>{busyDayCount}</strong> high-density day(s) this month with 5+ events
          </span>
        </div>
      )}

      {/* Calendar Header */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 mb-6">
        <div className="flex items-center gap-2">
          <Button variant="outline" size="icon" onClick={handlePrev}>
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <h2 className="text-xl font-display font-semibold min-w-[200px] text-center">
            {viewMode === 'week'
              ? `${format(weekDays[0], 'MMM d')} - ${format(weekDays[6], 'MMM d, yyyy')}`
              : format(currentMonth, 'MMMM yyyy')}
          </h2>
          <Button variant="outline" size="icon" onClick={handleNext}>
            <ChevronRight className="h-4 w-4" />
          </Button>
          <Button variant="outline" onClick={handleToday}>
            Today
          </Button>
          <CalendarSubscribeDialog />
        </div>

        <div className="flex flex-wrap items-center gap-3">
          {/* View Toggle */}
          <ToggleGroup 
            type="single" 
            value={viewMode} 
            onValueChange={(v) => v && setViewMode(v as ViewMode)}
            className="hidden sm:flex"
          >
            <ToggleGroupItem value="month" aria-label="Month view">
              <LayoutGrid className="h-4 w-4" />
            </ToggleGroupItem>
            <ToggleGroupItem value="week" aria-label="Week view">
              <Calendar className="h-4 w-4" />
            </ToggleGroupItem>
            <ToggleGroupItem value="list" aria-label="List view">
              <List className="h-4 w-4" />
            </ToggleGroupItem>
          </ToggleGroup>

          {/* Series Filter */}
          <Select value={selectedSeries} onValueChange={setSelectedSeries}>
            <SelectTrigger className="w-40 bg-card">
              <SelectValue placeholder="All Series" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Series</SelectItem>
              {eventSeries.map((series) => (
                <SelectItem key={series.id} value={series.id}>
                  {series.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          {/* Filters */}
          <Select value={selectedStaff} onValueChange={setSelectedStaff}>
            <SelectTrigger className="w-36 bg-card">
              <SelectValue placeholder="All Staff" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Staff</SelectItem>
              {staffProfiles.map((profile) => (
                <SelectItem key={profile.id} value={profile.id}>
                  {profile.full_name || 'Unnamed Staff'}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select value={selectedEventType} onValueChange={setSelectedEventType}>
            <SelectTrigger className="w-36 bg-card">
              <SelectValue placeholder="All Types" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Types</SelectItem>
              {eventTypes.map((type) => (
                <SelectItem key={type.id} value={type.id}>
                  {type.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select value={selectedDeliveryMethod} onValueChange={setSelectedDeliveryMethod}>
            <SelectTrigger className="w-40 bg-card">
              <SelectValue placeholder="All Delivery" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Delivery</SelectItem>
              {deliveryMethods.map((method) => (
                <SelectItem key={method.id} value={method.id}>
                  {method.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Mobile view toggle */}
      <div className="sm:hidden mb-4">
        <ToggleGroup 
          type="single" 
          value={viewMode} 
          onValueChange={(v) => v && setViewMode(v as ViewMode)}
          className="w-full"
        >
          <ToggleGroupItem value="month" className="flex-1">
            <LayoutGrid className="h-4 w-4 mr-2" />
            Month
          </ToggleGroupItem>
          <ToggleGroupItem value="week" className="flex-1">
            <Calendar className="h-4 w-4 mr-2" />
            Week
          </ToggleGroupItem>
          <ToggleGroupItem value="list" className="flex-1">
            <List className="h-4 w-4 mr-2" />
            List
          </ToggleGroupItem>
        </ToggleGroup>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-12">
          <div className="animate-spin h-8 w-8 border-2 border-primary border-t-transparent rounded-full" />
        </div>
      ) : viewMode === 'list' ? (
        /* List View */
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="space-y-3"
        >
          {sortedListEvents.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              No events found for this period
            </div>
          ) : (
            sortedListEvents.map((event) => (
              <ListViewItem key={event.id} event={event} seriesColorMap={seriesColorMap} />
            ))
          )}
        </motion.div>
      ) : viewMode === 'week' ? (
        /* Week View */
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="bg-card border border-border rounded-xl overflow-hidden shadow-card"
        >
          <div className="grid grid-cols-7 border-b border-border">
            {weekDays.map((day) => (
              <div
                key={day.toISOString()}
                className={cn(
                  "py-3 text-center",
                  isToday(day) && "bg-primary/5"
                )}
              >
                <p className="text-xs text-muted-foreground">{format(day, 'EEE')}</p>
                <p className={cn(
                  "text-lg font-medium",
                  isToday(day) && "text-primary"
                )}>
                  {format(day, 'd')}
                </p>
              </div>
            ))}
          </div>
          <div className="grid grid-cols-7 min-h-[400px]">
            {weekDays.map((day) => {
              const dayEvents = getEventsForDay(day);
              const dayLeads = getLeadsForDay(day);
              return (
                <div
                  key={day.toISOString()}
                  className={cn(
                    "border-r border-border p-2 space-y-1",
                    isToday(day) && "bg-primary/5"
                  )}
                >
                  {dayLeads.map((lead) => (
                    <LeadTile key={`lead-${lead.id}`} lead={lead} />
                  ))}
                  {dayEvents.map((event) => (
                    <EventTile key={event.id} event={event} seriesColorMap={seriesColorMap} />
                  ))}
                </div>
              );
            })}
          </div>
        </motion.div>
      ) : (
        /* Month View */
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="bg-card border border-border rounded-xl overflow-hidden shadow-card"
        >
          {/* Weekday Headers */}
          <div className="grid grid-cols-7 border-b border-border">
            {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((day) => (
              <div
                key={day}
                className="py-3 text-center text-sm font-medium text-muted-foreground"
              >
                {day}
              </div>
            ))}
          </div>

          {/* Calendar Days */}
          <div className="grid grid-cols-7">
            {/* Empty cells for days before the first of the month */}
            {Array.from({ length: startDayOfWeek }).map((_, index) => (
              <div key={`empty-${index}`} className="min-h-[120px] border-b border-r border-border bg-muted/30" />
            ))}

              {monthDays.map((day) => {
                const dayEvents = getEventsForDay(day);
                const dayLeads = getLeadsForDay(day);
                const isCurrentDay = isToday(day);
                const totalItems = dayEvents.length + dayLeads.length;
                const isBusyDay = totalItems >= 5;
                const dateStr = format(day, 'yyyy-MM-dd');

                return (
                  <div
                    key={day.toISOString()}
                    className={cn(
                      'min-h-[120px] border-b border-r border-border p-2 transition-colors',
                      !isSameMonth(day, currentMonth) && 'bg-muted/30',
                      isCurrentDay && 'bg-primary/5',
                      isBusyDay && 'ring-1 ring-inset ring-primary/30'
                    )}
                  >
                    <div className="flex items-center justify-between mb-2">
                      <span
                        className={cn(
                          'w-7 h-7 flex items-center justify-center text-sm rounded-full',
                          isCurrentDay && 'bg-primary text-primary-foreground font-semibold'
                        )}
                      >
                        {format(day, 'd')}
                      </span>
                      {isBusyDay && (
                        <button
                          onClick={() => navigate(`/calendar/day?date=${dateStr}`)}
                          className="flex items-center gap-1 text-xs bg-primary/10 text-primary px-1.5 py-0.5 rounded hover:bg-primary/20 transition-colors"
                        >
                          <Eye className="h-3 w-3" />
                          {totalItems}
                        </button>
                      )}
                    </div>
                    <div className="space-y-1">
                      {/* Show leads first */}
                      {dayLeads.slice(0, 2).map((lead) => (
                        <LeadTile key={`lead-${lead.id}`} lead={lead} />
                      ))}
                      {/* Then events */}
                      {dayEvents.slice(0, 3 - Math.min(dayLeads.length, 2)).map((event) => (
                        <EventTile key={event.id} event={event} seriesColorMap={seriesColorMap} />
                      ))}
                      {totalItems > 3 && (
                        <>
                          <button
                            onClick={() => navigate(`/calendar/day?date=${dateStr}`)}
                            className="text-xs text-muted-foreground pl-1.5 hover:text-primary transition-colors"
                          >
                            +{totalItems - 3} more
                          </button>
                          <DaySummaryBadge events={dayEvents} />
                        </>
                      )}
                    </div>
                  </div>
                );
              })}
          </div>
        </motion.div>
      )}
    </AppLayout>
  );
}
