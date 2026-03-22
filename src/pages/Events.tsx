import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { format, parseISO, isToday, isFuture } from 'date-fns';
import { motion } from 'framer-motion';
import {
  Calendar,
  ChevronRight,
  Clock,
  MapPin,
  Plus,
  Search,
} from 'lucide-react';
import { AppLayout } from '@/components/layout/AppLayout';
import { PageHeader } from '@/components/layout/PageHeader';
import { StatusBadge } from '@/components/ui/status-badge';
import { InvoiceStatusBadge } from '@/components/ui/invoice-status-badge';
import { OpsStatusBadge } from '@/components/ui/ops-status-badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Users } from 'lucide-react';
import { useAuth } from '@/lib/auth';
import { useEvents } from '@/hooks/useEvents';
import { useEventTypes, useDeliveryMethods } from '@/hooks/useLookups';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export default function Events() {
  const { isAdmin } = useAuth();
  const { data: events = [], isLoading } = useEvents();
  const { data: eventTypes = [] } = useEventTypes();
  const { data: deliveryMethods = [] } = useDeliveryMethods();
  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('current');
  const [deliveryFilter, setDeliveryFilter] = useState('all');

  // Fetch assignment counts for all events
  const { data: assignmentCounts = {} } = useQuery({
    queryKey: ['event-assignment-counts'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('event_assignments')
        .select('event_id, user_id, staff_id');
      if (error) throw error;
      const counts: Record<string, number> = {};
      (data || []).forEach((a) => {
        counts[a.event_id] = (counts[a.event_id] || 0) + 1;
      });
      return counts;
    },
  });

  // Create lookup maps for display
  const eventTypeMap = useMemo(() => {
    return eventTypes.reduce((acc, et) => {
      acc[et.id] = et.name;
      return acc;
    }, {} as Record<string, string>);
  }, [eventTypes]);

  const deliveryMethodMap = useMemo(() => {
    return deliveryMethods.reduce((acc, dm) => {
      acc[dm.id] = dm.name;
      return acc;
    }, {} as Record<string, string>);
  }, [deliveryMethods]);

  const filteredEvents = useMemo(() => {
    return events.filter((event) => {
      const matchesSearch =
        event.event_name.toLowerCase().includes(search.toLowerCase()) ||
        event.client_name.toLowerCase().includes(search.toLowerCase()) ||
        event.venue_name?.toLowerCase().includes(search.toLowerCase());

      // Support both new FK-based and legacy enum-based filtering
      const eventTypeName = event.event_type_id 
        ? eventTypeMap[event.event_type_id]?.toLowerCase() 
        : event.event_type?.toLowerCase();
      const matchesType = typeFilter === 'all' || eventTypeName === typeFilter.toLowerCase();

      // Delivery method filter
      const deliveryMethodName = event.delivery_method_id
        ? deliveryMethodMap[event.delivery_method_id]?.toLowerCase()
        : event.delivery_method?.replace('_', ' ').toLowerCase();
      const matchesDelivery = deliveryFilter === 'all' || deliveryMethodName === deliveryFilter.toLowerCase();

      const opsStatus = (event as any).ops_status;
      const isArchived = opsStatus === 'archived';
      const isCompleted = opsStatus === 'completed';
      
      let filterCategory: string;
      if (isArchived) {
        filterCategory = 'archived';
      } else if (isCompleted) {
        filterCategory = 'completed';
      } else {
        // Events stay "current" until explicitly marked completed/archived
        filterCategory = 'current';
      }
      
      const matchesStatus = statusFilter === 'all' || filterCategory === statusFilter;

      return matchesSearch && matchesType && matchesStatus && matchesDelivery;
    });
  }, [events, search, typeFilter, statusFilter, deliveryFilter, eventTypeMap, deliveryMethodMap]);

  const getEventStatus = (dateStr: string, event?: any) => {
    if (event?.ops_status === 'archived') return 'archived';
    if (event?.ops_status === 'completed') return 'completed';
    return 'upcoming';
  };

  // Get display name for event type
  const getEventTypeName = (event: typeof events[0]) => {
    if (event.event_type_id && eventTypeMap[event.event_type_id]) {
      return eventTypeMap[event.event_type_id];
    }
    // Fallback to legacy enum
    return event.event_type?.replace('_', ' ') || 'Other';
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
            <SelectItem value="all">All Types</SelectItem>
            {eventTypes.map((type) => (
              <SelectItem key={type.id} value={type.name.toLowerCase()}>
                {type.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={deliveryFilter} onValueChange={setDeliveryFilter}>
          <SelectTrigger className="w-full sm:w-40 bg-card border-border">
            <SelectValue placeholder="Delivery" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Delivery</SelectItem>
            {deliveryMethods.map((method) => (
              <SelectItem key={method.id} value={method.name.toLowerCase()}>
                {method.name}
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
            <SelectItem value="current">Current</SelectItem>
            <SelectItem value="completed">Completed</SelectItem>
            <SelectItem value="archived">Archived</SelectItem>
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
                    <div className="flex items-center gap-2 mb-1 flex-wrap">
                      <h3 className="font-medium truncate">{event.event_name}</h3>
                      <StatusBadge status={getEventStatus(event.event_date, event)} />
                      {isAdmin && (
                        <>
                          <OpsStatusBadge status={(event as any).ops_status} />
                          <InvoiceStatusBadge 
                            status={(event as any).invoice_status} 
                            reference={(event as any).invoice_reference}
                          />
                        </>
                      )}
                    </div>
                    <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-muted-foreground">
                      <span className="capitalize">{getEventTypeName(event)}</span>
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
                      {(assignmentCounts[event.id] || 0) > 0 && (
                        <>
                          <span className="hidden sm:inline">•</span>
                          <span className="hidden sm:flex items-center gap-1">
                            <Users className="h-3.5 w-3.5" />
                            {assignmentCounts[event.id]}
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
