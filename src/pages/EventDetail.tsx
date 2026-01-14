import { useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { format, parseISO } from 'date-fns';
import { motion } from 'framer-motion';
import { QRCodeSVG } from 'qrcode.react';
import {
  ArrowLeft,
  Calendar,
  Clock,
  Edit,
  ExternalLink,
  MapPin,
  Package,
  Phone,
  Trash2,
  User,
  Users,
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
import { useAuth } from '@/lib/auth';
import { useEvent, useEventAssignments, useDeleteEvent } from '@/hooks/useEvents';

export default function EventDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { isAdmin } = useAuth();
  const { data: event, isLoading } = useEvent(id);
  const { data: assignments = [] } = useEventAssignments(id);
  const deleteEvent = useDeleteEvent();

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
  const deliveryLink = event.delivery_method ? `https://gallery.eventpix.com.au/${event.id}` : null;

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
            {event.event_type} • {event.client_name}
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

          {/* Assigned Staff */}
          <div className="bg-card border border-border rounded-xl p-5 shadow-card">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-display font-semibold">Assigned Staff</h2>
              {isAdmin && (
                <Link to={`/events/${id}/assignments`}>
                  <Button variant="outline" size="sm">
                    <Users className="h-4 w-4 mr-2" />
                    Manage
                  </Button>
                </Link>
              )}
            </div>
            {assignments.length === 0 ? (
              <p className="text-muted-foreground text-sm">No staff assigned yet</p>
            ) : (
              <div className="space-y-3">
                {assignments.map((assignment) => (
                  <div
                    key={assignment.id}
                    className="flex items-center gap-3 p-3 bg-muted/50 rounded-lg"
                  >
                    <div className="w-10 h-10 rounded-full bg-primary/20 flex items-center justify-center">
                      <span className="text-sm font-medium text-primary">
                        {assignment.staff?.name?.[0] || '?'}
                      </span>
                    </div>
                    <div className="flex-1">
                      <p className="font-medium">{assignment.staff?.name}</p>
                      <p className="text-sm text-muted-foreground capitalize">
                        {assignment.role_on_event || assignment.staff?.role}
                      </p>
                    </div>
                  </div>
                ))}
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
          {/* Delivery Info */}
          <div className="bg-card border border-border rounded-xl p-5 shadow-card">
            <div className="flex items-center gap-2 mb-4">
              <Package className="h-5 w-5 text-primary" />
              <h2 className="text-lg font-display font-semibold">Delivery</h2>
            </div>
            {event.delivery_method ? (
              <div className="space-y-4">
                <div>
                  <p className="text-sm text-muted-foreground">Method</p>
                  <p className="font-medium capitalize">
                    {event.delivery_method.replace('_', ' ')}
                  </p>
                </div>
                {event.delivery_deadline && (
                  <div>
                    <p className="text-sm text-muted-foreground">Deadline</p>
                    <p className="font-medium">
                      {format(parseISO(event.delivery_deadline), 'MMM d, yyyy')}
                    </p>
                  </div>
                )}
                {deliveryLink && (
                  <div>
                    <p className="text-sm text-muted-foreground mb-2">Gallery QR Code</p>
                    <div className="bg-white p-4 rounded-lg inline-block">
                      <QRCodeSVG value={deliveryLink} size={120} />
                    </div>
                    <a
                      href={deliveryLink}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="mt-3 flex items-center gap-1 text-sm text-primary hover:underline"
                    >
                      <ExternalLink className="h-3.5 w-3.5" />
                      Open Gallery Link
                    </a>
                  </div>
                )}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">No delivery method set</p>
            )}
          </div>

          {/* Quick Actions */}
          <div className="bg-card border border-border rounded-xl p-5 shadow-card">
            <h2 className="text-lg font-display font-semibold mb-4">Quick Actions</h2>
            <div className="space-y-2">
              <Link to={`/events/${id}/worksheets`} className="block">
                <Button variant="outline" className="w-full justify-start">
                  View Worksheets
                </Button>
              </Link>
              <Link to={`/events/${id}/delivery`} className="block">
                <Button variant="outline" className="w-full justify-start">
                  Manage Delivery
                </Button>
              </Link>
            </div>
          </div>
        </motion.div>
      </div>
    </AppLayout>
  );
}
