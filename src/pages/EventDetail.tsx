import { useMemo } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { format, parseISO } from 'date-fns';
import { motion } from 'framer-motion';
import {
  ArrowLeft,
  Calendar,
  Clock,
  Edit,
  MapPin,
  Package,
  Phone,
  Trash2,
  User,
} from 'lucide-react';
import { AppLayout } from '@/components/layout/AppLayout';
import { Button } from '@/components/ui/button';
import { StatusBadge } from '@/components/ui/status-badge';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useAuth } from '@/lib/auth';
import { useEvent, useEventAssignments, useDeleteEvent } from '@/hooks/useEvents';
import { useEventTypes, useDeliveryMethods } from '@/hooks/useLookups';
import { StaffAssignmentDialog } from '@/components/StaffAssignmentDialog';
import { DeliveryManager } from '@/components/DeliveryManager';

export default function EventDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { isAdmin } = useAuth();
  const { data: event, isLoading } = useEvent(id);
  const { data: assignments = [] } = useEventAssignments(id);
  const { data: eventTypes = [] } = useEventTypes();
  const { data: deliveryMethods = [] } = useDeliveryMethods();
  const deleteEvent = useDeleteEvent();

  // Create lookup maps
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

  // Helper to get event type name
  const getEventTypeName = () => {
    if (!event) return '';
    if (event.event_type_id && eventTypeMap[event.event_type_id]) {
      return eventTypeMap[event.event_type_id];
    }
    return event.event_type?.replace('_', ' ') || 'Other';
  };

  // Helper to get delivery method name
  const getDeliveryMethodName = () => {
    if (!event) return '';
    if (event.delivery_method_id && deliveryMethodMap[event.delivery_method_id]) {
      return deliveryMethodMap[event.delivery_method_id];
    }
    return event.delivery_method?.replace('_', ' ') || '';
  };

  const handleDelete = async () => {
    if (id) {
      await deleteEvent.mutateAsync(id);
      navigate('/events');
    }
  };

  if (isLoading) {
    return (
      <AppLayout>
        <div className="animate-pulse">
          <div className="h-8 bg-muted rounded w-1/3 mb-4" />
          <div className="h-4 bg-muted rounded w-1/4 mb-8" />
          <div className="h-64 bg-muted rounded" />
        </div>
      </AppLayout>
    );
  }

  if (!event) {
    return (
      <AppLayout>
        <div className="text-center py-12">
          <p className="text-muted-foreground">Event not found</p>
          <Link to="/events">
            <Button variant="outline" className="mt-4">
              Back to Events
            </Button>
          </Link>
        </div>
      </AppLayout>
    );
  }

  const date = parseISO(event.event_date);

  return (
    <AppLayout>
      {/* Header */}
      <div className="flex items-start justify-between mb-6">
        <div>
          <Link
            to="/events"
            className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground mb-3"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to Events
          </Link>
          <div className="flex items-center gap-3 mb-2">
            <h1 className="text-2xl lg:text-3xl font-display font-bold">
              {event.event_name}
            </h1>
            <StatusBadge
              status={new Date() < date ? 'upcoming' : new Date().toDateString() === date.toDateString() ? 'today' : 'past'}
            />
          </div>
          <p className="text-muted-foreground capitalize">
            {getEventTypeName()} • {event.client_name}
          </p>
        </div>
        {isAdmin && (
          <div className="flex items-center gap-2">
            <Link to={`/events/${id}/edit`}>
              <Button variant="outline">
                <Edit className="h-4 w-4 mr-2" />
                Edit
              </Button>
            </Link>
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button variant="outline" className="text-destructive hover:text-destructive">
                  <Trash2 className="h-4 w-4" />
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Delete Event</AlertDialogTitle>
                  <AlertDialogDescription>
                    This will permanently delete this event and all associated data.
                    This action cannot be undone.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                  <AlertDialogAction
                    onClick={handleDelete}
                    className="bg-destructive hover:bg-destructive/90"
                  >
                    Delete
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </div>
        )}
      </div>

      <Tabs defaultValue="overview" className="space-y-6">
        <TabsList>
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="assignments">Assignments</TabsTrigger>
          <TabsTrigger value="delivery">Delivery</TabsTrigger>
        </TabsList>

        <TabsContent value="overview">
          <div className="grid lg:grid-cols-3 gap-6">
            {/* Main Info */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="lg:col-span-2 space-y-6"
            >
              {/* Event Details */}
              <div className="bg-card border border-border rounded-xl p-5 shadow-card">
                <h2 className="text-lg font-display font-semibold mb-4">Event Details</h2>
                <div className="grid sm:grid-cols-2 gap-4">
                  <div className="flex items-start gap-3">
                    <div className="p-2 bg-primary/10 rounded-lg">
                      <Calendar className="h-4 w-4 text-primary" />
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">Date</p>
                      <p className="font-medium">{format(date, 'EEEE, MMMM d, yyyy')}</p>
                    </div>
                  </div>
                  <div className="flex items-start gap-3">
                    <div className="p-2 bg-primary/10 rounded-lg">
                      <Clock className="h-4 w-4 text-primary" />
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">Time</p>
                      <p className="font-medium">
                        {event.start_time
                          ? `${format(new Date(`2000-01-01T${event.start_time}`), 'h:mm a')}${
                              event.end_time
                                ? ` - ${format(new Date(`2000-01-01T${event.end_time}`), 'h:mm a')}`
                                : ''
                            }`
                          : 'TBD'}
                      </p>
                    </div>
                  </div>
                  {event.venue_name && (
                    <div className="flex items-start gap-3 sm:col-span-2">
                      <div className="p-2 bg-primary/10 rounded-lg">
                        <MapPin className="h-4 w-4 text-primary" />
                      </div>
                      <div>
                        <p className="text-sm text-muted-foreground">Venue</p>
                        <p className="font-medium">{event.venue_name}</p>
                        {event.venue_address && (
                          <p className="text-sm text-muted-foreground">{event.venue_address}</p>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* Contact Info */}
              <div className="bg-card border border-border rounded-xl p-5 shadow-card">
                <h2 className="text-lg font-display font-semibold mb-4">Contact Information</h2>
                <div className="grid sm:grid-cols-2 gap-4">
                  <div className="flex items-start gap-3">
                    <div className="p-2 bg-muted rounded-lg">
                      <User className="h-4 w-4 text-muted-foreground" />
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">Client</p>
                      <p className="font-medium">{event.client_name}</p>
                    </div>
                  </div>
                  {event.onsite_contact_name && (
                    <div className="flex items-start gap-3">
                      <div className="p-2 bg-muted rounded-lg">
                        <Phone className="h-4 w-4 text-muted-foreground" />
                      </div>
                      <div>
                        <p className="text-sm text-muted-foreground">On-site Contact</p>
                        <p className="font-medium">{event.onsite_contact_name}</p>
                        {event.onsite_contact_phone && (
                          <a
                            href={`tel:${event.onsite_contact_phone}`}
                            className="text-sm text-primary hover:underline"
                          >
                            {event.onsite_contact_phone}
                          </a>
                        )}
                      </div>
                    </div>
                  )}
                </div>
                {event.coverage_details && (
                  <div className="mt-4 pt-4 border-t border-border">
                    <p className="text-sm text-muted-foreground mb-1">Coverage Details</p>
                    <p className="text-sm">{event.coverage_details}</p>
                  </div>
                )}
                {event.notes && (
                  <div className="mt-4 pt-4 border-t border-border">
                    <p className="text-sm text-muted-foreground mb-1">Notes</p>
                    <p className="text-sm">{event.notes}</p>
                  </div>
                )}
              </div>
            </motion.div>

            {/* Sidebar */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 }}
              className="space-y-6"
            >
              {/* Quick Actions */}
              <div className="bg-card border border-border rounded-xl p-5 shadow-card">
                <h2 className="text-lg font-display font-semibold mb-4">Quick Actions</h2>
                <div className="space-y-2">
                  <Link to={`/events/${id}/worksheets`} className="block">
                    <Button variant="outline" className="w-full justify-start">
                      View Worksheets
                    </Button>
                  </Link>
                </div>
              </div>
            </motion.div>
          </div>
        </TabsContent>

        <TabsContent value="assignments">
          <div className="bg-card border border-border rounded-xl p-5 shadow-card">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-display font-semibold">Assigned Staff</h2>
              {isAdmin && id && (
                <StaffAssignmentDialog eventId={id} assignments={assignments} />
              )}
            </div>
            {assignments.length === 0 ? (
              <p className="text-muted-foreground text-sm">No staff assigned yet</p>
            ) : (
              <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {assignments.map((assignment) => {
                  const name = assignment.profile?.full_name || assignment.staff?.name || 'Unknown';
                  const role = assignment.staff_role?.name || assignment.role_on_event || assignment.staff?.role || 'Staff';
                  const initial = name.charAt(0).toUpperCase();
                  
                  return (
                    <div
                      key={assignment.id}
                      className="flex items-center gap-3 p-4 bg-muted/50 rounded-lg"
                    >
                      <div className="w-12 h-12 rounded-full bg-primary/20 flex items-center justify-center">
                        <span className="text-lg font-medium text-primary">
                          {initial}
                        </span>
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-medium truncate">{name}</p>
                        <p className="text-sm text-muted-foreground capitalize">
                          {role}
                        </p>
                        {assignment.assignment_notes && (
                          <p className="text-xs text-muted-foreground mt-1 truncate">
                            {assignment.assignment_notes}
                          </p>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </TabsContent>

        <TabsContent value="delivery">
          {id && <DeliveryManager eventId={id} isAdmin={isAdmin} />}
        </TabsContent>
      </Tabs>
    </AppLayout>
  );
}
