import { useMemo, useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { format, parseISO, formatDistanceToNow } from 'date-fns';
import { motion } from 'framer-motion';
import {
  ArrowLeft,
  Calendar,
  Clock,
  Edit,
  Mail,
  MapPin,
  Package,
  Phone,
  Play,
  Trash2,
  User,
  History,
  Wand2,
  ExternalLink,
} from 'lucide-react';
import { AppLayout } from '@/components/layout/AppLayout';
import { RecommendCrewDialog } from '@/components/RecommendCrewDialog';
import { Button } from '@/components/ui/button';
import { StatusBadge } from '@/components/ui/status-badge';
import { InvoiceStatusBadge } from '@/components/ui/invoice-status-badge';
import { OpsStatusBadge } from '@/components/ui/ops-status-badge';
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { useAuth } from '@/lib/auth';
import { useEvent, useEventAssignments, useDeleteEvent, useUpdateEvent } from '@/hooks/useEvents';
import { useEventTypes, useDeliveryMethods } from '@/hooks/useLookups';
import { useAuditLog, getActivityDescription } from '@/hooks/useAuditLog';
import { StaffAssignmentDialog } from '@/components/StaffAssignmentDialog';
import { DeliveryManager } from '@/components/DeliveryManager';
import { EventEquipmentPanel } from '@/components/EventEquipmentPanel';
import { SessionsDisplay } from '@/components/SessionsDisplay';
import { useEventContacts } from '@/hooks/useEventContacts';
import { VenueAddressLink } from '@/components/VenueAddressLink';
import { EventTasksCard } from '@/components/EventTasksCard';
import { SendOpsEmailDialog } from '@/components/SendOpsEmailDialog';
import { JobWorkflowRail } from '@/components/JobWorkflowRail';
import { InitializeWorkflowDialog } from '@/components/InitializeWorkflowDialog';

export default function EventDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { isAdmin } = useAuth();
  const { data: event, isLoading } = useEvent(id);
  const { data: assignments = [] } = useEventAssignments(id);
  const { data: eventTypes = [] } = useEventTypes();
  const { data: deliveryMethods = [] } = useDeliveryMethods();
  const { data: auditLog = [] } = useAuditLog(id);
  const deleteEvent = useDeleteEvent();
  const updateEvent = useUpdateEvent();
  
  // Status update state
  const [isUpdatingStatus, setIsUpdatingStatus] = useState(false);
  const [recommendCrewOpen, setRecommendCrewOpen] = useState(false);
  const [sendEmailOpen, setSendEmailOpen] = useState(false);
  
  // Build recipients for email dialog
  const emailRecipients = useMemo(() => {
    const recipients: { id: string; name: string; email: string; type: 'client' | 'photographer' | 'assistant' }[] = [];
    
    // Add assigned staff
    assignments.forEach((assignment: any) => {
      const profile = assignment.user || assignment.profile;
      if (profile?.email) {
        const roleOnEvent = assignment.role_on_event?.toLowerCase() || '';
        const type = roleOnEvent.includes('assistant') ? 'assistant' : 'photographer';
        recipients.push({
          id: assignment.id,
          name: profile.full_name || profile.email,
          email: profile.email,
          type,
        });
      }
    });
    
    return recipients;
  }, [assignments]);
  
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
          <div className="flex items-center gap-3 mb-2 flex-wrap">
            <h1 className="text-2xl lg:text-3xl font-display font-bold">
              {event.event_name}
            </h1>
            <StatusBadge
              status={new Date() < date ? 'upcoming' : new Date().toDateString() === date.toDateString() ? 'today' : 'past'}
            />
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
          {isAdmin && (
            <TabsTrigger value="equipment">
              <Package className="h-4 w-4 mr-1" />
              Equipment
            </TabsTrigger>
          )}
          <TabsTrigger value="delivery">Delivery</TabsTrigger>
          <TabsTrigger value="activity">Activity</TabsTrigger>
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
                      <div className="flex-1">
                        <p className="text-sm text-muted-foreground">Venue</p>
                        <VenueAddressLink 
                          address={event.venue_address} 
                          venueName={event.venue_name} 
                        />
                      </div>
                    </div>
                  )}
                </div>
                
                {/* Venue Access & Parking Notes */}
                {((event as any).venue_access_notes || (event as any).venue_parking_notes) && (
                  <div className="mt-4 pt-4 border-t border-border grid sm:grid-cols-2 gap-4">
                    {(event as any).venue_access_notes && (
                      <div>
                        <p className="text-sm text-muted-foreground mb-1">Access Notes</p>
                        <p className="text-sm">{(event as any).venue_access_notes}</p>
                      </div>
                    )}
                    {(event as any).venue_parking_notes && (
                      <div>
                        <p className="text-sm text-muted-foreground mb-1">Parking Notes</p>
                        <p className="text-sm">{(event as any).venue_parking_notes}</p>
                      </div>
                    )}
                  </div>
                )}
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
                  <Link to={`/events/${id}/day-of`} className="block">
                    <Button variant="default" className="w-full justify-start">
                      <Play className="h-4 w-4 mr-2" />
                      {isAdmin ? 'Day-Of View' : 'Job Sheet'}
                    </Button>
                  </Link>
                  <Link to={`/events/${id}/worksheets`} className="block">
                    <Button variant="outline" className="w-full justify-start">
                      View Worksheets
                    </Button>
                  </Link>
                  {isAdmin && (
                    <Button variant="outline" className="w-full justify-start" onClick={() => setSendEmailOpen(true)}>
                      <Mail className="h-4 w-4 mr-2" />
                      Send Email
                    </Button>
                  )}
                </div>
              </div>

              {/* Workflow Rail - Admin/Ops Only */}
              {isAdmin && id && (
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <InitializeWorkflowDialog 
                      eventId={id} 
                      currentTemplateId={(event as any).workflow_template_id}
                    />
                  </div>
                  <JobWorkflowRail eventId={id} isAdmin={isAdmin} />
                </div>
              )}

              {/* Setup Tasks */}
              {isAdmin && id && <EventTasksCard eventId={id} />}

              {isAdmin && (
                <div className="bg-card border border-border rounded-xl p-5 shadow-card">
                  <h2 className="text-lg font-display font-semibold mb-4">Status</h2>
                  <div className="space-y-4">
                    <div className="space-y-2">
                      <Label htmlFor="ops_status">Operations Status</Label>
                      <Select
                        value={(event as any).ops_status || 'awaiting_details'}
                        onValueChange={async (value) => {
                          setIsUpdatingStatus(true);
                          await updateEvent.mutateAsync({
                            id: event.id,
                            ops_status: value,
                          });
                          setIsUpdatingStatus(false);
                        }}
                        disabled={isUpdatingStatus}
                      >
                        <SelectTrigger id="ops_status">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="awaiting_details">Awaiting Details</SelectItem>
                          <SelectItem value="ready">Ready</SelectItem>
                          <SelectItem value="in_progress">In Progress</SelectItem>
                          <SelectItem value="delivered">Delivered</SelectItem>
                          <SelectItem value="closed">Closed</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="invoice_status">Invoice Status</Label>
                      <Select
                        value={(event as any).invoice_status || 'not_invoiced'}
                        onValueChange={async (value) => {
                          setIsUpdatingStatus(true);
                          await updateEvent.mutateAsync({
                            id: event.id,
                            invoice_status: value,
                          });
                          setIsUpdatingStatus(false);
                        }}
                        disabled={isUpdatingStatus}
                      >
                        <SelectTrigger id="invoice_status">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="not_invoiced">Not Invoiced</SelectItem>
                          <SelectItem value="invoiced">Invoiced</SelectItem>
                          <SelectItem value="paid">Paid</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="invoice_reference">Invoice Reference</Label>
                      <Input
                        id="invoice_reference"
                        placeholder="e.g., INV-12345"
                        defaultValue={(event as any).invoice_reference || ''}
                        onBlur={async (e) => {
                          const value = e.target.value;
                          if (value !== (event as any).invoice_reference) {
                            setIsUpdatingStatus(true);
                            await updateEvent.mutateAsync({
                              id: event.id,
                              invoice_reference: value || null,
                            });
                            setIsUpdatingStatus(false);
                          }
                        }}
                        disabled={isUpdatingStatus}
                      />
                    </div>
                  </div>
                </div>
              )}
            </motion.div>
          </div>
        </TabsContent>

        <TabsContent value="assignments">
          <div className="bg-card border border-border rounded-xl p-5 shadow-card">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-display font-semibold">Assigned Staff</h2>
              {isAdmin && id && (
                <div className="flex items-center gap-2">
                  <Button variant="outline" size="sm" onClick={() => setRecommendCrewOpen(true)}>
                    <Wand2 className="h-4 w-4 mr-2" />
                    Recommend Crew
                  </Button>
                  <StaffAssignmentDialog eventId={id} assignments={assignments} />
                </div>
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
        {/* Equipment Tab (Admin Only) */}
        {isAdmin && id && (
          <TabsContent value="equipment">
            <EventEquipmentPanel eventId={id} />
          </TabsContent>
        )}

        <TabsContent value="activity">
          <div className="bg-card border border-border rounded-xl p-5 shadow-card">
            <div className="flex items-center gap-2 mb-4">
              <History className="h-5 w-5 text-muted-foreground" />
              <h2 className="text-lg font-display font-semibold">Activity Log</h2>
            </div>
            {auditLog.length === 0 ? (
              <p className="text-muted-foreground text-sm">No activity recorded yet</p>
            ) : (
              <div className="space-y-4">
                {auditLog.map((entry) => {
                  const { action, detail } = getActivityDescription(entry);
                  const actorName = entry.actor?.full_name || entry.actor?.email || 'System';
                  
                  return (
                    <div key={entry.id} className="flex gap-3 pb-4 border-b border-border last:border-0">
                      <div className="w-8 h-8 rounded-full bg-muted flex items-center justify-center shrink-0">
                        <span className="text-xs font-medium text-muted-foreground">
                          {actorName.charAt(0).toUpperCase()}
                        </span>
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm">
                          <span className="font-medium">{actorName}</span>
                          {' '}
                          <span className="text-muted-foreground">{action.toLowerCase()}</span>
                        </p>
                        <p className="text-sm text-muted-foreground">{detail}</p>
                        <p className="text-xs text-muted-foreground mt-1">
                          {formatDistanceToNow(new Date(entry.created_at), { addSuffix: true })}
                        </p>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </TabsContent>
      </Tabs>
      
      {/* Recommend Crew Dialog */}
      {id && (
        <RecommendCrewDialog
          open={recommendCrewOpen}
          onOpenChange={setRecommendCrewOpen}
          eventIds={[id]}
          scope="single_event"
        />
      )}
      
      {/* Send Email Dialog */}
      {id && event && (
        <SendOpsEmailDialog
          open={sendEmailOpen}
          onOpenChange={setSendEmailOpen}
          eventId={id}
          eventData={{
            event_name: event.event_name,
            event_date: event.event_date,
            start_time: event.start_time,
            end_time: event.end_time,
            venue_name: event.venue_name,
            venue_address: event.venue_address,
            client_name: event.client_name,
            client_id: event.client_id,
          }}
          recipients={emailRecipients}
        />
      )}
    </AppLayout>
  );
}
