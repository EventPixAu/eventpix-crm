import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  format,
  startOfMonth,
  endOfMonth,
  eachDayOfInterval,
  isSameMonth,
  isSameDay,
  addMonths,
  subMonths,
  parseISO,
  isToday,
} from 'date-fns';
import { motion } from 'framer-motion';
import { ChevronLeft, ChevronRight, Clock, MapPin } from 'lucide-react';
import { AppLayout } from '@/components/layout/AppLayout';
import { PageHeader } from '@/components/layout/PageHeader';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useEvents } from '@/hooks/useEvents';
import { useStaff } from '@/hooks/useStaff';
import { cn } from '@/lib/utils';

export default function CalendarView() {
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [selectedStaff, setSelectedStaff] = useState('all');
  const { data: events = [] } = useEvents();
  const { data: staff = [] } = useStaff();

  const days = useMemo(() => {
    const start = startOfMonth(currentMonth);
    const end = endOfMonth(currentMonth);
    return eachDayOfInterval({ start, end });
  }, [currentMonth]);

  const eventsByDate = useMemo(() => {
    const map = new Map<string, typeof events>();
    events.forEach((event) => {
      const dateKey = event.event_date;
      if (!map.has(dateKey)) {
        map.set(dateKey, []);
      }
      map.get(dateKey)!.push(event);
    });
    return map;
  }, [events]);

  const getEventsForDay = (day: Date) => {
    const dateKey = format(day, 'yyyy-MM-dd');
    return eventsByDate.get(dateKey) || [];
  };

  // Get day of week for first day of month (0 = Sunday)
  const startDayOfWeek = startOfMonth(currentMonth).getDay();

  return (
    <AppLayout>
      <PageHeader
        title="Calendar"
        description="View all scheduled events"
      />

      {/* Calendar Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="icon"
            onClick={() => setCurrentMonth(subMonths(currentMonth, 1))}
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <h2 className="text-xl font-display font-semibold min-w-[180px] text-center">
            {format(currentMonth, 'MMMM yyyy')}
          </h2>
          <Button
            variant="outline"
            size="icon"
            onClick={() => setCurrentMonth(addMonths(currentMonth, 1))}
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
        <div className="flex items-center gap-3">
          <Button
            variant="outline"
            onClick={() => setCurrentMonth(new Date())}
          >
            Today
          </Button>
          <Select value={selectedStaff} onValueChange={setSelectedStaff}>
            <SelectTrigger className="w-40 bg-card">
              <SelectValue placeholder="Filter by staff" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Staff</SelectItem>
              {staff.map((member) => (
                <SelectItem key={member.id} value={member.id}>
                  {member.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Calendar Grid */}
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

          {days.map((day, index) => {
            const dayEvents = getEventsForDay(day);
            const isCurrentDay = isToday(day);

            return (
              <div
                key={day.toISOString()}
                className={cn(
                  'min-h-[120px] border-b border-r border-border p-2 transition-colors',
                  !isSameMonth(day, currentMonth) && 'bg-muted/30',
                  isCurrentDay && 'bg-primary/5'
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
                </div>
                <div className="space-y-1">
                  {dayEvents.slice(0, 3).map((event) => (
                    <Link
                      key={event.id}
                      to={`/events/${event.id}`}
                      className="block text-xs p-1.5 rounded bg-primary/10 hover:bg-primary/20 transition-colors truncate"
                    >
                      <span className="font-medium text-primary">
                        {event.start_time && format(new Date(`2000-01-01T${event.start_time}`), 'h:mm a')}
                      </span>
                      <span className="ml-1 text-foreground">{event.event_name}</span>
                    </Link>
                  ))}
                  {dayEvents.length > 3 && (
                    <p className="text-xs text-muted-foreground pl-1.5">
                      +{dayEvents.length - 3} more
                    </p>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </motion.div>
    </AppLayout>
  );
}
