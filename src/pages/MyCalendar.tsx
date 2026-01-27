import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
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
  Calendar,
  List,
  LayoutGrid
} from 'lucide-react';
import { AppLayout } from '@/components/layout/AppLayout';
import { PageHeader } from '@/components/layout/PageHeader';
import { CalendarSubscribeDialog } from '@/components/CalendarSubscribeDialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  ToggleGroup,
  ToggleGroupItem,
} from '@/components/ui/toggle-group';
import { useStaffCalendarEvents, getVenueSuburb, type CalendarEvent } from '@/hooks/useCalendar';
import { cn } from '@/lib/utils';

type ViewMode = 'month' | 'week' | 'list';

function EventTile({ event }: { event: CalendarEvent }) {
  const suburb = getVenueSuburb(event.venue_address) || event.venue_name;
  // Use arrival_time (crew call) if available, otherwise fall back to start_time
  const displayTime = event.arrival_time || event.start_time;
  
  return (
    <Link
      to={`/events/${event.id}`}
      className={cn(
        "block text-xs p-1.5 rounded transition-colors truncate border-l-2",
        event.has_conflict 
          ? "bg-orange-100 dark:bg-orange-900/30 border-orange-500 hover:bg-orange-200 dark:hover:bg-orange-900/50"
          : event.needs_attention
          ? "bg-amber-100 dark:bg-amber-900/30 border-amber-500 hover:bg-amber-200 dark:hover:bg-amber-900/50"
          : "bg-primary/10 border-primary hover:bg-primary/20"
      )}
    >
      <div className="flex items-center gap-1">
        {displayTime && (
          <span className="font-medium text-primary shrink-0">
            {format(new Date(`2000-01-01T${displayTime}`), 'h:mm a')}
          </span>
        )}
        {event.arrival_time && (
          <span className="text-muted-foreground shrink-0">Call</span>
        )}
        {event.has_conflict && (
          <AlertTriangle className="h-3 w-3 text-orange-600 shrink-0" />
        )}
        {event.needs_attention && !event.has_conflict && (
          <Clock className="h-3 w-3 text-amber-600 shrink-0" />
        )}
      </div>
      <span className="text-foreground block truncate">{event.event_name}</span>
      {suburb && (
        <span className="text-muted-foreground truncate block">{suburb}</span>
      )}
    </Link>
  );
}

function ListViewItem({ event }: { event: CalendarEvent }) {
  const suburb = getVenueSuburb(event.venue_address) || event.venue_name;
  
  return (
    <Link
      to={`/events/${event.id}`}
      className={cn(
        "flex items-center gap-4 p-4 rounded-lg border transition-colors",
        event.has_conflict
          ? "border-orange-300 bg-orange-50 dark:bg-orange-900/20 hover:bg-orange-100 dark:hover:bg-orange-900/30"
          : event.needs_attention
          ? "border-amber-300 bg-amber-50 dark:bg-amber-900/20 hover:bg-amber-100 dark:hover:bg-amber-900/30"
          : "border-border bg-card hover:bg-muted/50"
      )}
    >
      <div className="text-center shrink-0 w-16">
        <p className="text-2xl font-bold text-primary">{format(new Date(event.event_date), 'd')}</p>
        <p className="text-xs text-muted-foreground uppercase">{format(new Date(event.event_date), 'EEE')}</p>
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <h3 className="font-medium truncate">{event.event_name}</h3>
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
          {/* Show crew call time prominently if available */}
          {event.arrival_time && (
            <span className="flex items-center gap-1 font-medium text-primary">
              <Clock className="h-3 w-3" />
              Call: {format(new Date(`2000-01-01T${event.arrival_time}`), 'h:mm a')}
            </span>
          )}
          {/* Show event time range */}
          {event.start_time && (
            <span className="flex items-center gap-1">
              {!event.arrival_time && <Clock className="h-3 w-3" />}
              {event.arrival_time ? 'Event: ' : ''}
              {format(new Date(`2000-01-01T${event.start_time}`), 'h:mm a')}
              {event.end_time && ` - ${format(new Date(`2000-01-01T${event.end_time}`), 'h:mm a')}`}
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
    </Link>
  );
}

export default function MyCalendar() {
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [currentWeek, setCurrentWeek] = useState(new Date());
  const [viewMode, setViewMode] = useState<ViewMode>('list');
  
  const { data: events = [], isLoading } = useStaffCalendarEvents(currentMonth);

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
    map.forEach((dayEvents) => {
      dayEvents.sort((a, b) => {
        if (!a.start_time) return 1;
        if (!b.start_time) return -1;
        return a.start_time.localeCompare(b.start_time);
      });
    });
    return map;
  }, [events]);

  const getEventsForDay = (day: Date) => {
    const dateKey = format(day, 'yyyy-MM-dd');
    return eventsByDate.get(dateKey) || [];
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
        title="My Calendar"
        description="Your assigned events and schedule"
        actions={<CalendarSubscribeDialog />}
      />

      {/* Calendar Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
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
        </div>

        <ToggleGroup 
          type="single" 
          value={viewMode} 
          onValueChange={(v) => v && setViewMode(v as ViewMode)}
        >
          <ToggleGroupItem value="list" aria-label="List view">
            <List className="h-4 w-4" />
          </ToggleGroupItem>
          <ToggleGroupItem value="month" aria-label="Month view">
            <LayoutGrid className="h-4 w-4" />
          </ToggleGroupItem>
          <ToggleGroupItem value="week" aria-label="Week view">
            <Calendar className="h-4 w-4" />
          </ToggleGroupItem>
        </ToggleGroup>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-12">
          <div className="animate-spin h-8 w-8 border-2 border-primary border-t-transparent rounded-full" />
        </div>
      ) : events.length === 0 ? (
        <div className="text-center py-12">
          <Calendar className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
          <h3 className="text-lg font-medium mb-2">No assigned events</h3>
          <p className="text-muted-foreground">
            You don't have any events assigned to you yet.
          </p>
        </div>
      ) : viewMode === 'list' ? (
        /* List View */
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="space-y-3"
        >
          {sortedListEvents.map((event) => (
            <ListViewItem key={event.id} event={event} />
          ))}
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
              return (
                <div
                  key={day.toISOString()}
                  className={cn(
                    "border-r border-border p-2 space-y-1",
                    isToday(day) && "bg-primary/5"
                  )}
                >
                  {dayEvents.map((event) => (
                    <EventTile key={event.id} event={event} />
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

          <div className="grid grid-cols-7">
            {Array.from({ length: startDayOfWeek }).map((_, index) => (
              <div key={`empty-${index}`} className="min-h-[100px] border-b border-r border-border bg-muted/30" />
            ))}

            {monthDays.map((day) => {
              const dayEvents = getEventsForDay(day);
              const isCurrentDay = isToday(day);

              return (
                <div
                  key={day.toISOString()}
                  className={cn(
                    'min-h-[100px] border-b border-r border-border p-2 transition-colors',
                    !isSameMonth(day, currentMonth) && 'bg-muted/30',
                    isCurrentDay && 'bg-primary/5'
                  )}
                >
                  <div className="flex items-center justify-between mb-1">
                    <span
                      className={cn(
                        'w-6 h-6 flex items-center justify-center text-sm rounded-full',
                        isCurrentDay && 'bg-primary text-primary-foreground font-semibold'
                      )}
                    >
                      {format(day, 'd')}
                    </span>
                  </div>
                  <div className="space-y-1">
                    {dayEvents.slice(0, 2).map((event) => (
                      <EventTile key={event.id} event={event} />
                    ))}
                    {dayEvents.length > 2 && (
                      <p className="text-xs text-muted-foreground">
                        +{dayEvents.length - 2} more
                      </p>
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
