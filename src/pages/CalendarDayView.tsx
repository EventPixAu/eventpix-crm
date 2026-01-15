import { useMemo, useState } from 'react';
import { Link, useSearchParams, useNavigate } from 'react-router-dom';
import { format, parseISO, addDays, subDays, isToday } from 'date-fns';
import { motion } from 'framer-motion';
import {
  ChevronLeft,
  ChevronRight,
  Clock,
  MapPin,
  Users,
  AlertTriangle,
  Phone,
  Edit,
  FileText,
  ClipboardList,
  ExternalLink,
  Calendar,
  Layers,
  UserPlus,
} from 'lucide-react';
import { AppLayout } from '@/components/layout/AppLayout';
import { PageHeader } from '@/components/layout/PageHeader';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { useAdminCalendarEvents, getVenueSuburb, type CalendarEvent } from '@/hooks/useCalendar';
import { useEventAssignments } from '@/hooks/useEvents';
import { cn } from '@/lib/utils';

// Time slots from 6am to 11pm
const TIME_SLOTS = Array.from({ length: 18 }, (_, i) => i + 6);

function TimeSlotLabel({ hour }: { hour: number }) {
  const ampm = hour >= 12 ? 'PM' : 'AM';
  const displayHour = hour > 12 ? hour - 12 : hour === 0 ? 12 : hour;
  return (
    <div className="text-xs text-muted-foreground w-16 shrink-0 text-right pr-2 py-2">
      {displayHour} {ampm}
    </div>
  );
}

function parseTimeToHour(timeStr: string | null): number | null {
  if (!timeStr) return null;
  const [hours] = timeStr.split(':').map(Number);
  return hours;
}

function EventAssignmentsList({ eventId }: { eventId: string }) {
  const { data: assignments = [] } = useEventAssignments(eventId);

  if (assignments.length === 0) {
    return (
      <p className="text-xs text-muted-foreground italic">No staff assigned</p>
    );
  }

  return (
    <div className="flex flex-wrap gap-1.5">
      {assignments.slice(0, 4).map((assignment) => {
        const name = assignment.profile?.full_name || assignment.staff?.name || 'Unknown';
        const role = assignment.staff_role?.name || assignment.role_on_event || 'Staff';
        const initial = name.charAt(0).toUpperCase();

        return (
          <Tooltip key={assignment.id}>
            <TooltipTrigger asChild>
              <div className="flex items-center gap-1 bg-muted/60 rounded-full px-2 py-0.5">
                <div className="w-5 h-5 rounded-full bg-primary/20 flex items-center justify-center text-xs font-medium text-primary">
                  {initial}
                </div>
                <span className="text-xs truncate max-w-[80px]">{name.split(' ')[0]}</span>
              </div>
            </TooltipTrigger>
            <TooltipContent>
              <p className="font-medium">{name}</p>
              <p className="text-xs text-muted-foreground capitalize">{role}</p>
            </TooltipContent>
          </Tooltip>
        );
      })}
      {assignments.length > 4 && (
        <div className="flex items-center gap-1 bg-muted/60 rounded-full px-2 py-0.5 text-xs text-muted-foreground">
          +{assignments.length - 4} more
        </div>
      )}
    </div>
  );
}

function TimelineEvent({ event, style }: { event: CalendarEvent; style: React.CSSProperties }) {
  const suburb = getVenueSuburb(event.venue_address) || event.venue_name;

  return (
    <motion.div
      initial={{ opacity: 0, x: -10 }}
      animate={{ opacity: 1, x: 0 }}
      className={cn(
        "absolute left-20 right-4 rounded-lg border p-3 overflow-hidden",
        event.has_conflict
          ? "bg-orange-50 dark:bg-orange-900/20 border-orange-300"
          : event.needs_attention
          ? "bg-amber-50 dark:bg-amber-900/20 border-amber-300"
          : "bg-card border-border"
      )}
      style={style}
    >
      <div className="flex items-start justify-between gap-2 mb-2">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <h3 className="font-semibold text-sm truncate">{event.event_name}</h3>
            {event.event_series_name && (
              <Badge variant="outline" className="shrink-0 text-xs">
                <Layers className="h-3 w-3 mr-1" />
                {event.event_series_name}
              </Badge>
            )}
            {event.has_conflict && (
              <Badge variant="destructive" className="shrink-0 text-xs">
                <AlertTriangle className="h-3 w-3 mr-1" />
                Conflict
              </Badge>
            )}
          </div>
          <p className="text-xs text-muted-foreground mt-0.5">{event.client_name}</p>
        </div>
        <div className="flex items-center gap-1 shrink-0">
          <Tooltip>
            <TooltipTrigger asChild>
              <Link to={`/events/${event.id}`}>
                <Button variant="ghost" size="icon" className="h-7 w-7">
                  <ExternalLink className="h-3.5 w-3.5" />
                </Button>
              </Link>
            </TooltipTrigger>
            <TooltipContent>View Event</TooltipContent>
          </Tooltip>
          <Tooltip>
            <TooltipTrigger asChild>
              <Link to={`/events/${event.id}/edit`}>
                <Button variant="ghost" size="icon" className="h-7 w-7">
                  <Edit className="h-3.5 w-3.5" />
                </Button>
              </Link>
            </TooltipTrigger>
            <TooltipContent>Edit Event</TooltipContent>
          </Tooltip>
        </div>
      </div>

      <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground mb-2">
        {event.start_time && (
          <span className="flex items-center gap-1">
            <Clock className="h-3 w-3" />
            {format(new Date(`2000-01-01T${event.start_time}`), 'h:mm a')}
            {event.end_time && ` - ${format(new Date(`2000-01-01T${event.end_time}`), 'h:mm a')}`}
          </span>
        )}
        {suburb && (
          <span className="flex items-center gap-1">
            <MapPin className="h-3 w-3" />
            {suburb}
          </span>
        )}
        {event.onsite_contact_phone && (
          <span className="flex items-center gap-1">
            <Phone className="h-3 w-3" />
            {event.onsite_contact_name || 'Contact'}
          </span>
        )}
      </div>

      <EventAssignmentsList eventId={event.id} />

      <div className="flex items-center gap-2 mt-2 pt-2 border-t border-border/50">
        <Link to={`/events/${event.id}/worksheets`}>
          <Button variant="outline" size="sm" className="h-7 text-xs">
            <ClipboardList className="h-3 w-3 mr-1" />
            Worksheets
          </Button>
        </Link>
        <Link to={`/events/${event.id}/run-sheet`}>
          <Button variant="outline" size="sm" className="h-7 text-xs">
            <FileText className="h-3 w-3 mr-1" />
            Run Sheet
          </Button>
        </Link>
      </div>
    </motion.div>
  );
}

function DayEventCard({ event }: { event: CalendarEvent }) {
  const suburb = getVenueSuburb(event.venue_address) || event.venue_name;

  return (
    <Card className={cn(
      event.has_conflict && "border-orange-300 bg-orange-50/50 dark:bg-orange-900/10",
      event.needs_attention && !event.has_conflict && "border-amber-300 bg-amber-50/50 dark:bg-amber-900/10"
    )}>
      <CardHeader className="pb-2">
        <div className="flex items-start justify-between">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap mb-1">
              <CardTitle className="text-base truncate">{event.event_name}</CardTitle>
              {event.event_series_name && (
                <Badge variant="outline" className="shrink-0 text-xs">
                  <Layers className="h-3 w-3 mr-1" />
                  {event.event_series_name}
                </Badge>
              )}
            </div>
            <p className="text-sm text-muted-foreground">{event.client_name}</p>
          </div>
          {event.has_conflict && (
            <Badge variant="destructive" className="shrink-0">
              <AlertTriangle className="h-3 w-3 mr-1" />
              Conflict
            </Badge>
          )}
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="flex flex-wrap gap-x-4 gap-y-1 text-sm text-muted-foreground">
          {event.start_time && (
            <span className="flex items-center gap-1">
              <Clock className="h-4 w-4" />
              {format(new Date(`2000-01-01T${event.start_time}`), 'h:mm a')}
              {event.end_time && ` - ${format(new Date(`2000-01-01T${event.end_time}`), 'h:mm a')}`}
            </span>
          )}
          {suburb && (
            <span className="flex items-center gap-1">
              <MapPin className="h-4 w-4" />
              {suburb}
            </span>
          )}
          {event.onsite_contact_phone && (
            <a
              href={`tel:${event.onsite_contact_phone}`}
              className="flex items-center gap-1 hover:text-primary"
            >
              <Phone className="h-4 w-4" />
              {event.onsite_contact_name || event.onsite_contact_phone}
            </a>
          )}
        </div>

        <div>
          <p className="text-xs font-medium text-muted-foreground mb-1.5 flex items-center gap-1">
            <Users className="h-3 w-3" />
            Assigned Staff
          </p>
          <EventAssignmentsList eventId={event.id} />
        </div>

        <div className="flex flex-wrap gap-2 pt-2 border-t">
          <Link to={`/events/${event.id}`}>
            <Button variant="outline" size="sm">
              <ExternalLink className="h-4 w-4 mr-1" />
              View
            </Button>
          </Link>
          <Link to={`/events/${event.id}/edit`}>
            <Button variant="outline" size="sm">
              <Edit className="h-4 w-4 mr-1" />
              Edit
            </Button>
          </Link>
          <Link to={`/events/${event.id}/worksheets`}>
            <Button variant="outline" size="sm">
              <ClipboardList className="h-4 w-4 mr-1" />
              Worksheets
            </Button>
          </Link>
          <Link to={`/events/${event.id}/run-sheet`}>
            <Button variant="outline" size="sm">
              <FileText className="h-4 w-4 mr-1" />
              Run Sheet
            </Button>
          </Link>
        </div>
      </CardContent>
    </Card>
  );
}

export default function CalendarDayView() {
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();
  const dateParam = searchParams.get('date');
  const selectedDate = dateParam ? parseISO(dateParam) : new Date();
  
  const [viewType, setViewType] = useState<'timeline' | 'cards'>('timeline');

  // Fetch events for the month containing selected date
  const { data: allEvents = [], isLoading } = useAdminCalendarEvents(selectedDate);

  // Filter to just this day's events
  const dayEvents = useMemo(() => {
    const dateKey = format(selectedDate, 'yyyy-MM-dd');
    return allEvents
      .filter(e => e.event_date === dateKey)
      .sort((a, b) => {
        if (!a.start_time) return 1;
        if (!b.start_time) return -1;
        return a.start_time.localeCompare(b.start_time);
      });
  }, [allEvents, selectedDate]);

  // Group by series for summary
  const seriesSummary = useMemo(() => {
    const groups = new Map<string, number>();
    dayEvents.forEach(e => {
      const key = e.event_series_name || 'Other Events';
      groups.set(key, (groups.get(key) || 0) + 1);
    });
    return Array.from(groups.entries()).sort((a, b) => b[1] - a[1]);
  }, [dayEvents]);

  // Staff summary
  const totalAssignments = dayEvents.reduce((sum, e) => sum + e.assignment_count, 0);
  const conflictCount = dayEvents.filter(e => e.has_conflict).length;

  const navigateDay = (direction: 'prev' | 'next') => {
    const newDate = direction === 'prev' 
      ? subDays(selectedDate, 1) 
      : addDays(selectedDate, 1);
    setSearchParams({ date: format(newDate, 'yyyy-MM-dd') });
  };

  const goToToday = () => {
    setSearchParams({ date: format(new Date(), 'yyyy-MM-dd') });
  };

  // Calculate position for timeline events
  const getEventStyle = (event: CalendarEvent): React.CSSProperties => {
    const startHour = parseTimeToHour(event.start_time) ?? 9;
    const endHour = parseTimeToHour(event.end_time) ?? startHour + 2;
    const duration = Math.max(endHour - startHour, 1);
    
    const top = (startHour - 6) * 48; // 48px per hour
    const height = duration * 48 - 4;
    
    return { top: `${top}px`, height: `${height}px`, minHeight: '80px' };
  };

  return (
    <AppLayout>
      <PageHeader
        title="Day View"
        description={format(selectedDate, 'EEEE, MMMM d, yyyy')}
        actions={
          <Link to="/calendar">
            <Button variant="outline">
              <Calendar className="h-4 w-4 mr-2" />
              Back to Calendar
            </Button>
          </Link>
        }
      />

      {/* Navigation and Stats */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 mb-6">
        <div className="flex items-center gap-2">
          <Button variant="outline" size="icon" onClick={() => navigateDay('prev')}>
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <h2 className="text-xl font-display font-semibold min-w-[220px] text-center">
            {format(selectedDate, 'EEE, MMM d, yyyy')}
          </h2>
          <Button variant="outline" size="icon" onClick={() => navigateDay('next')}>
            <ChevronRight className="h-4 w-4" />
          </Button>
          {!isToday(selectedDate) && (
            <Button variant="outline" onClick={goToToday}>
              Today
            </Button>
          )}
        </div>

        <div className="flex items-center gap-3">
          <Button
            variant={viewType === 'timeline' ? 'default' : 'outline'}
            size="sm"
            onClick={() => setViewType('timeline')}
          >
            Timeline
          </Button>
          <Button
            variant={viewType === 'cards' ? 'default' : 'outline'}
            size="sm"
            onClick={() => setViewType('cards')}
          >
            Cards
          </Button>
        </div>
      </div>

      {/* Stats Bar */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <Card>
          <CardContent className="p-4 flex items-center gap-3">
            <div className="p-2 rounded-lg bg-primary/10">
              <Calendar className="h-5 w-5 text-primary" />
            </div>
            <div>
              <p className="text-2xl font-bold">{dayEvents.length}</p>
              <p className="text-xs text-muted-foreground">Events</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 flex items-center gap-3">
            <div className="p-2 rounded-lg bg-primary/10">
              <Users className="h-5 w-5 text-primary" />
            </div>
            <div>
              <p className="text-2xl font-bold">{totalAssignments}</p>
              <p className="text-xs text-muted-foreground">Assignments</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 flex items-center gap-3">
            <div className="p-2 rounded-lg bg-primary/10">
              <Layers className="h-5 w-5 text-primary" />
            </div>
            <div>
              <p className="text-2xl font-bold">{seriesSummary.length}</p>
              <p className="text-xs text-muted-foreground">Series</p>
            </div>
          </CardContent>
        </Card>
        <Card className={conflictCount > 0 ? "border-orange-300" : ""}>
          <CardContent className="p-4 flex items-center gap-3">
            <div className={cn(
              "p-2 rounded-lg",
              conflictCount > 0 ? "bg-orange-100 dark:bg-orange-900/20" : "bg-muted"
            )}>
              <AlertTriangle className={cn(
                "h-5 w-5",
                conflictCount > 0 ? "text-orange-600" : "text-muted-foreground"
              )} />
            </div>
            <div>
              <p className="text-2xl font-bold">{conflictCount}</p>
              <p className="text-xs text-muted-foreground">Conflicts</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Series Summary */}
      {seriesSummary.length > 0 && (
        <div className="flex flex-wrap gap-2 mb-6">
          {seriesSummary.map(([name, count]) => (
            <Badge key={name} variant="secondary" className="px-3 py-1">
              {count} × {name}
            </Badge>
          ))}
        </div>
      )}

      {isLoading ? (
        <div className="flex items-center justify-center py-12">
          <div className="animate-spin h-8 w-8 border-2 border-primary border-t-transparent rounded-full" />
        </div>
      ) : dayEvents.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <Calendar className="h-12 w-12 text-muted-foreground mb-4" />
            <h3 className="text-lg font-semibold mb-2">No Events Scheduled</h3>
            <p className="text-muted-foreground mb-4">There are no events on this day.</p>
            <Link to="/events/new">
              <Button>
                <UserPlus className="h-4 w-4 mr-2" />
                Create Event
              </Button>
            </Link>
          </CardContent>
        </Card>
      ) : viewType === 'timeline' ? (
        /* Timeline View */
        <Card>
          <CardContent className="p-0">
            <div className="relative" style={{ height: `${18 * 48}px` }}>
              {/* Time slots background */}
              {TIME_SLOTS.map((hour) => (
                <div
                  key={hour}
                  className="absolute left-0 right-0 flex items-start border-t border-border/50"
                  style={{ top: `${(hour - 6) * 48}px`, height: '48px' }}
                >
                  <TimeSlotLabel hour={hour} />
                  <div className="flex-1 h-full" />
                </div>
              ))}
              
              {/* Events */}
              {dayEvents.map((event) => (
                <TimelineEvent
                  key={event.id}
                  event={event}
                  style={getEventStyle(event)}
                />
              ))}
            </div>
          </CardContent>
        </Card>
      ) : (
        /* Cards View */
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {dayEvents.map((event) => (
            <DayEventCard key={event.id} event={event} />
          ))}
        </div>
      )}
    </AppLayout>
  );
}
