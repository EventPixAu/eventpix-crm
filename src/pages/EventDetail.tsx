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
  Send,
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
import { useClientByBusinessName } from '@/hooks/useClientByBusinessName';
import { StaffAssignmentDialog } from '@/components/StaffAssignmentDialog';
import { EventEquipmentPanel } from '@/components/EventEquipmentPanel';
import { SessionsDisplay } from '@/components/SessionsDisplay';
import { useEventContacts, CONTACT_TYPES } from '@/hooks/useEventContacts';
import { VenueAddressLink } from '@/components/VenueAddressLink';
import { EventTasksCard } from '@/components/EventTasksCard';
import { SendOpsEmailDialog } from '@/components/SendOpsEmailDialog';
import { JobWorkflowRail } from '@/components/JobWorkflowRail';
import { InitializeWorkflowDialog } from '@/components/InitializeWorkflowDialog';
import { ContractsPanel } from '@/components/ContractsPanel';
import { MailHistoryPanel } from '@/components/MailHistoryPanel';
import { Badge } from '@/components/ui/badge';
import { EventContactsCard } from '@/components/EventContactsCard';
import { AssignmentChecklistPanel } from '@/components/AssignmentChecklistPanel';
import { EventDocumentsPanel } from '@/components/EventDocumentsPanel';
import { useSendNotification } from '@/hooks/useNotifications';

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
  const sendNotification = useSendNotification();
  
  // Status update state
  const [isUpdatingStatus, setIsUpdatingStatus] = useState(false);
  const [recommendCrewOpen, setRecommendCrewOpen] = useState(false);
  const [sendEmailOpen, setSendEmailOpen] = useState(false);

  // If the event is not linked to a client (client_id is null), try resolving by legacy client_name.
  const { data: clientByName } = useClientByBusinessName(event?.client_id ? undefined : event?.client_name);
  
  // Fetch event contacts for email recipients
  const { data: eventContacts = [] } = useEventContacts(id);
  
  // Build recipients for email dialog
  const emailRecipients = useMemo(() => {
    const recipients: { id: string; name: string; email: string; type: 'client' | 'photographer' | 'assistant' }[] = [];
    
    // Add client primary contact (linked client record OR fallback match by business name)
    const client = (event?.client_id ? (event as any).clients : clientByName) as any;
    const clientEmail = client?.primary_contact_email;
    const clientContactName = client?.primary_contact_name;
    const clientId = client?.id;
    if (clientEmail && !recipients.find(r => r.email === clientEmail)) {
      recipients.push({
        id: clientId ? `client-${clientId}` : `client-name-${event?.client_name || 'unknown'}`,
        name: clientContactName || event?.client_name || clientEmail,
        email: clientEmail,
        type: 'client',
      });
    }
    
    // Add event contacts with emails (these are client-side contacts)
    eventContacts.forEach((contact: any) => {
      const email = contact.contact_email || contact.client_contact?.email;
      const name = contact.contact_name || contact.client_contact?.contact_name;
      if (email && !recipients.find(r => r.email === email)) {
        recipients.push({
          id: `event-contact-${contact.id}`,
          name: name || email,
          email,
          type: 'client',
        });
      }
    });
    
    // Add assigned staff (support both new user-based and legacy staff-based)
    assignments.forEach((assignment: any) => {
      // Try new user profile first, then legacy staff
      const profile = assignment.profile;
      const legacyStaff = assignment.staff;
      
      const email = profile?.email || legacyStaff?.email;
      const name = profile?.full_name || legacyStaff?.name;
      
      if (email && !recipients.find(r => r.email === email)) {
        // Determine type from staff_role or legacy role field
        const roleName = assignment.staff_role?.name?.toLowerCase() || 
                        assignment.role_on_event?.toLowerCase() || 
                        legacyStaff?.role?.toLowerCase() || '';
        const type = roleName.includes('assistant') ? 'assistant' : 'photographer';
        recipients.push({
          id: assignment.id,
          name: name || email,
          email,
          type,
        });
      }
    });
    
    return recipients;
  }, [event, assignments, eventContacts, clientByName]);
  
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
          <TabsTrigger value="activity">Activity</TabsTrigger>
        </TabsList>

        <TabsContent value="overview">
          <div className="grid lg:grid-cols-3 gap-6">
            {/* Column 1: Event Details, Sessions, Contacts */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="space-y-6"
            >
              {/* Event Details */}
              <div className="bg-card border border-border rounded-xl p-5 shadow-card">
                <h2 className="text-lg font-display font-semibold mb-4">Event Details</h2>
                <div className="space-y-4">
                  <div className="flex items-start gap-3">
                    <div className="p-2 bg-primary/10 rounded-lg">
                      <Calendar className="h-4 w-4 text-primary" />
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">Start Date</p>
                      <p className="font-medium">{format(date, 'EEEE, MMMM d, yyyy')}</p>
                    </div>
                  </div>

                  {/* Event Type - Inline Editable for Admin */}
                  <div className="flex items-start gap-3">
                    <div className="p-2 bg-primary/10 rounded-lg">
                      <Calendar className="h-4 w-4 text-primary" />
                    </div>
                    <div className="flex-1">
                      <p className="text-sm text-muted-foreground">Event Type</p>
                      {isAdmin ? (
                        <Select
                          value={event.event_type_id || ''}
                          onValueChange={async (value) => {
                            setIsUpdatingStatus(true);
                            await updateEvent.mutateAsync({
                              id: event.id,
                              event_type_id: value,
                            });
                            setIsUpdatingStatus(false);
                          }}
                          disabled={isUpdatingStatus}
                        >
                          <SelectTrigger className="h-8 w-full max-w-[200px] mt-1">
                            <SelectValue placeholder="Select type" />
                          </SelectTrigger>
                          <SelectContent>
                            {eventTypes.map((type) => (
                              <SelectItem key={type.id} value={type.id}>
                                {type.name}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      ) : (
                        <p className="font-medium capitalize">{getEventTypeName()}</p>
                      )}
                    </div>
                  </div>

                  {/* Delivery Method - Inline Editable for Admin */}
                  <div className="flex items-start gap-3">
                    <div className="p-2 bg-primary/10 rounded-lg">
                      <Package className="h-4 w-4 text-primary" />
                    </div>
                    <div className="flex-1">
                      <p className="text-sm text-muted-foreground">Delivery Method</p>
                      {isAdmin ? (
                        <Select
                          value={event.delivery_method_id || ''}
                          onValueChange={async (value) => {
                            setIsUpdatingStatus(true);
                            await updateEvent.mutateAsync({
                              id: event.id,
                              delivery_method_id: value,
                            });
                            setIsUpdatingStatus(false);
                          }}
                          disabled={isUpdatingStatus}
                        >
                          <SelectTrigger className="h-8 w-full max-w-[200px] mt-1">
                            <SelectValue placeholder="Select method" />
                          </SelectTrigger>
                          <SelectContent>
                            {deliveryMethods.map((method) => (
                              <SelectItem key={method.id} value={method.id}>
                                {method.name}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      ) : (
                        <p className="font-medium capitalize">{getDeliveryMethodName() || 'Not set'}</p>
                      )}
                    </div>
                  </div>

                  {event.venue_name && (
                    <div className="flex items-start gap-3">
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
                  <div className="mt-4 pt-4 border-t border-border space-y-3">
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


              {/* Sessions / Multiple Dates */}
              {id && (
                <div className="bg-card border border-border rounded-xl p-5 shadow-card">
                  <div className="flex items-center justify-between mb-4">
                    <h2 className="text-lg font-display font-semibold">Sessions / Time Blocks</h2>
                    {isAdmin && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => navigate(`/events/${id}/edit?tab=sessions`)}
                      >
                        <Edit className="h-4 w-4 mr-1" />
                        Edit
                      </Button>
                    )}
                  </div>
                  <SessionsDisplay eventId={id} />
                </div>
              )}

              {/* Event Contacts from CRM */}
              <EventContactsCard
                eventId={id!}
                clientName={event.client_name}
                clientDetails={(event?.client_id ? (event as any).clients : clientByName) as any}
                onsiteContact={{
                name: event.onsite_contact_name,
                phone: event.onsite_contact_phone,
                }}
              />
            </motion.div>

            {/* Column 2: Additional Details, Documents, Contracts */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.05 }}
              className="space-y-6"
            >
              {/* Coverage, Photography Instructions & Notes */}
              {(event.coverage_details || (event as any).photography_brief || event.notes) && (
                <div className="bg-card border border-border rounded-xl p-5 shadow-card">
                  <h2 className="text-lg font-display font-semibold mb-4">Additional Details</h2>
                  {event.coverage_details && (
                    <div className="mb-4">
                      <p className="text-sm text-muted-foreground mb-1">Coverage Details</p>
                      <p className="text-sm">{event.coverage_details}</p>
                    </div>
                  )}
                  {(event as any).photography_brief && (
                    <div className="mb-4">
                      <p className="text-sm text-muted-foreground mb-1">Photography Instructions</p>
                      <p className="text-sm whitespace-pre-wrap">{(event as any).photography_brief}</p>
                    </div>
                  )}
                  {event.notes && (
                    <div>
                      <p className="text-sm text-muted-foreground mb-1">Notes</p>
                      <p className="text-sm whitespace-pre-wrap">{event.notes}</p>
                    </div>
                  )}
                </div>
              )}
              
              {/* Event Documents */}
              {id && (
                <EventDocumentsPanel eventId={id} isAdmin={isAdmin} />
              )}
              
              {/* Contracts Panel */}
              {isAdmin && id && event.client_id && (
                <ContractsPanel
                  eventId={id}
                  clientId={event.client_id}
                  clientName={(event as any).client_name}
                  clientEmail={(event as any).clients?.primary_contact_email}
                  quoteId={(event as any).quote_id}
                  eventName={(event as any).event_name}
                  eventDate={(event as any).event_date}
                  defaultOpen={true}
                />
              )}
            </motion.div>

            {/* Column 3: Quick Actions, Mail History, Workflow, Tasks, Status */}
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

              {/* Mail History */}
              {isAdmin && id && (
                <MailHistoryPanel eventId={id} maxItems={5} />
              )}

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
                      className="flex flex-col p-4 bg-muted/50 rounded-lg"
                    >
                      <div className="flex items-start gap-3">
                        <div className="w-12 h-12 rounded-full bg-primary/20 flex items-center justify-center shrink-0">
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
                        {isAdmin && (
                          <Button
                            variant="outline"
                            size="sm"
                            className="shrink-0 h-8"
                            onClick={() => {
                              const userId = assignment.user_id || assignment.staff?.id;
                              if (!userId || !id) return;
                              sendNotification.mutate({
                                type: 'assignment',
                                event_id: id,
                                user_id: userId,
                                assignment_id: assignment.id,
                              });
                            }}
                            disabled={sendNotification.isPending}
                            title="Resend notification email"
                          >
                            <Send className="h-4 w-4 mr-2" />
                            Resend
                          </Button>
                        )}
                      </div>
                      
                      {/* Checklist panel for this assignment */}
                      {isAdmin && id && (
                        <AssignmentChecklistPanel 
                          eventId={id} 
                          assignment={assignment} 
                        />
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </TabsContent>

        {/* Equipment Tab (Admin Only) */}
        {isAdmin && id && (
          <TabsContent value="equipment">
            <EventEquipmentPanel eventId={id} assignments={assignments} />
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
