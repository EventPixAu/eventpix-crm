import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { format, parseISO, isToday, isFuture } from 'date-fns';
import { motion } from 'framer-motion';
import {
  Calendar,
  ChevronRight,
  Clock,
  Filter,
  MapPin,
  Plus,
  Search,
  Users,
} from 'lucide-react';
import { AppLayout } from '@/components/layout/AppLayout';
import { PageHeader } from '@/components/layout/PageHeader';
import { StatusBadge } from '@/components/ui/status-badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useAuth } from '@/lib/auth';
import { useEvents } from '@/hooks/useEvents';

const eventTypes = [
  { value: 'all', label: 'All Types' },
  { value: 'wedding', label: 'Wedding' },
  { value: 'corporate', label: 'Corporate' },
  { value: 'birthday', label: 'Birthday' },
  { value: 'conference', label: 'Conference' },
  { value: 'gala', label: 'Gala' },
  { value: 'festival', label: 'Festival' },
  { value: 'private', label: 'Private' },
  { value: 'sports', label: 'Sports' },
  { value: 'other', label: 'Other' },
];

export default function Events() {
  const { isAdmin } = useAuth();
  const { data: events = [], isLoading } = useEvents();
  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');

  const filteredEvents = useMemo(() => {
    return events.filter((event) => {
      const matchesSearch =
        event.event_name.toLowerCase().includes(search.toLowerCase()) ||
        event.client_name.toLowerCase().includes(search.toLowerCase()) ||
        event.venue_name?.toLowerCase().includes(search.toLowerCase());

      const matchesType = typeFilter === 'all' || event.event_type === typeFilter;

      const date = parseISO(event.event_date);
      const status = isToday(date) ? 'today' : isFuture(date) ? 'upcoming' : 'past';
      const matchesStatus = statusFilter === 'all' || status === statusFilter;

      return matchesSearch && matchesType && matchesStatus;
    });
  }, [events, search, typeFilter, statusFilter]);

  const getEventStatus = (dateStr: string) => {
    const date = parseISO(dateStr);
    if (isToday(date)) return 'today';
    if (isFuture(date)) return 'upcoming';
    return 'past';
  };

  return (
    <AppLayout>
      <PageHeader
        title="Events"
        description={`${events.length} total events`}
        actions={
          isAdmin && (
            <Link to="/events/new">
              <Button className="bg-gradient-primary hover:opacity-90">
                <Plus className="h-4 w-4 mr-2" />
                New Event
              </Button>
            </Link>
          )
        }
      />

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3 mb-6">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search events..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9 bg-card border-border"
          />
        </div>
        <Select value={typeFilter} onValueChange={setTypeFilter}>
          <SelectTrigger className="w-full sm:w-40 bg-card border-border">
            <SelectValue placeholder="Event type" />
          </SelectTrigger>
          <SelectContent>
            {eventTypes.map((type) => (
              <SelectItem key={type.value} value={type.value}>
                {type.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-full sm:w-36 bg-card border-border">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Status</SelectItem>
            <SelectItem value="today">Today</SelectItem>
            <SelectItem value="upcoming">Upcoming</SelectItem>
            <SelectItem value="past">Past</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Events List */}
      {isLoading ? (
        <div className="bg-card border border-border rounded-xl p-8 text-center text-muted-foreground">
          Loading events...
        </div>
      ) : filteredEvents.length === 0 ? (
        <div className="bg-card border border-border rounded-xl p-8 text-center">
          <Calendar className="h-12 w-12 mx-auto text-muted-foreground/50 mb-3" />
          <p className="text-muted-foreground">No events found</p>
          {isAdmin && search === '' && typeFilter === 'all' && statusFilter === 'all' && (
            <Link to="/events/new">
              <Button variant="outline" className="mt-4">
                Create your first event
              </Button>
            </Link>
          )}
        </div>
      ) : (
        <div className="bg-card border border-border rounded-xl overflow-hidden shadow-card">
          <div className="divide-y divide-border">
            {filteredEvents.map((event, index) => (
              <motion.div
                key={event.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.05 }}
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
                    <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-muted-foreground">
                      <span className="capitalize">{event.event_type}</span>
                      <span>•</span>
                      <span>{event.client_name}</span>
                      {event.start_time && (
                        <>
                          <span>•</span>
                          <span className="flex items-center gap-1">
                            <Clock className="h-3.5 w-3.5" />
                            {format(new Date(`2000-01-01T${event.start_time}`), 'h:mm a')}
                          </span>
                        </>
                      )}
                      {event.venue_name && (
                        <>
                          <span className="hidden sm:inline">•</span>
                          <span className="hidden sm:flex items-center gap-1 truncate">
                            <MapPin className="h-3.5 w-3.5" />
                            {event.venue_name}
                          </span>
                        </>
                      )}
                    </div>
                  </div>
                  <ChevronRight className="h-5 w-5 text-muted-foreground flex-shrink-0" />
                </Link>
              </motion.div>
            ))}
          </div>
        </div>
      )}
    </AppLayout>
  );
}
