/**
 * OPERATIONS DASHBOARD
 * 
 * Operations-focused dashboard showing:
 * - Today's events & upcoming events
 * - Readiness queues and escalations
 * - Staff and delivery status
 */
import { useMemo } from 'react';
import { Link } from 'react-router-dom';
import { format, isToday, isFuture, parseISO } from 'date-fns';
import { motion } from 'framer-motion';
import { 
  Calendar, 
  Camera, 
  ChevronRight, 
  Clock, 
  MapPin, 
  Package 
} from 'lucide-react';
import { AppLayout } from '@/components/layout/AppLayout';
import { PageHeader } from '@/components/layout/PageHeader';
import { StatCard } from '@/components/ui/stat-card';
import { StatusBadge } from '@/components/ui/status-badge';
import { Button } from '@/components/ui/button';
import { AdminReadinessQueues } from '@/components/AdminReadinessQueues';
import { EscalationBanners } from '@/components/EscalationBanners';
import { useAuth } from '@/lib/auth';
import { useEvents } from '@/hooks/useEvents';

export default function OperationsDashboard() {
  const { user } = useAuth();
  const { data: events = [], isLoading: eventsLoading } = useEvents();

  const stats = useMemo(() => {
    const todayEvents = events.filter(e => isToday(parseISO(e.event_date)));
    const upcomingEvents = events.filter(e => isFuture(parseISO(e.event_date)));

    return {
      totalEvents: events.length,
      todayEvents: todayEvents.length,
      upcomingEvents: upcomingEvents.length,
    };
  }, [events]);

  const upcomingEvents = useMemo(() => {
    return events
      .filter(e => {
        const date = parseISO(e.event_date);
        return isToday(date) || isFuture(date);
      })
      .slice(0, 5);
  }, [events]);

  const getEventStatus = (dateStr: string) => {
    const date = parseISO(dateStr);
    if (isToday(date)) return 'today';
    if (isFuture(date)) return 'upcoming';
    return 'past';
  };

  return (
    <AppLayout>
      <PageHeader
        title="Operations Dashboard"
        description={`Operations overview${user?.email ? ` - ${user.email.split('@')[0]}` : ''}`}
        actions={
          <Link to="/events/new">
            <Button className="bg-gradient-primary hover:opacity-90">
              <Calendar className="h-4 w-4 mr-2" />
              New Event
            </Button>
          </Link>
        }
      />

      <EscalationBanners maxItems={3} />

      <div className="grid grid-cols-3 gap-4 mb-8">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
        >
          <StatCard
            title="Today's Events"
            value={stats.todayEvents}
            icon={Camera}
            variant="primary"
          />
        </motion.div>
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
        >
          <StatCard
            title="Upcoming"
            value={stats.upcomingEvents}
            icon={Calendar}
            variant="default"
          />
        </motion.div>
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
        >
          <StatCard
            title="Total Events"
            value={stats.totalEvents}
            icon={Package}
            variant="default"
          />
        </motion.div>
      </div>

      <div className="grid lg:grid-cols-3 gap-6">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          className="bg-card border border-border rounded-xl shadow-card lg:col-span-2"
        >
          <div className="flex items-center justify-between p-5 border-b border-border">
            <h2 className="text-lg font-display font-semibold">Upcoming Events</h2>
            <Link to="/events" className="text-sm text-primary hover:underline">
              View all
            </Link>
          </div>
          
          {eventsLoading ? (
            <div className="p-8 text-center text-muted-foreground">
              Loading events...
            </div>
          ) : upcomingEvents.length === 0 ? (
            <div className="p-8 text-center">
              <Calendar className="h-12 w-12 mx-auto text-muted-foreground/50 mb-3" />
              <p className="text-muted-foreground">No upcoming events</p>
              <Link to="/events/new">
                <Button variant="outline" className="mt-4">
                  Create your first event
                </Button>
              </Link>
            </div>
          ) : (
            <div className="divide-y divide-border">
              {upcomingEvents.map((event, index) => (
                <motion.div
                  key={event.id}
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.1 * index }}
                >
                  <Link
                    to={`/events/${event.id}`}
                    className="flex items-center gap-4 p-4 hover:bg-muted/50 transition-colors"
                  >
                    <div className="flex-shrink-0 w-14 h-14 bg-primary/10 rounded-xl flex flex-col items-center justify-center">
                      <span className="text-xs text-muted-foreground uppercase">
                        {format(parseISO(event.event_date), 'MMM')}
                      </span>
                      <span className="text-lg font-display font-bold text-primary">
                        {format(parseISO(event.event_date), 'd')}
                      </span>
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <h3 className="font-medium truncate">{event.event_name}</h3>
                        <StatusBadge status={getEventStatus(event.event_date)} />
                      </div>
                      <div className="flex items-center gap-4 text-sm text-muted-foreground">
                        <span className="flex items-center gap-1">
                          <Clock className="h-3.5 w-3.5" />
                          {event.start_time ? format(new Date(`2000-01-01T${event.start_time}`), 'h:mm a') : 'TBD'}
                        </span>
                        {event.venue_name && (
                          <span className="flex items-center gap-1 truncate">
                            <MapPin className="h-3.5 w-3.5" />
                            {event.venue_name}
                          </span>
                        )}
                      </div>
                    </div>
                    <ChevronRight className="h-5 w-5 text-muted-foreground" />
                  </Link>
                </motion.div>
              ))}
            </div>
          )}
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4 }}
        >
          <AdminReadinessQueues />
        </motion.div>
      </div>
    </AppLayout>
  );
}
