import { useMemo, useState, useCallback } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { format, parseISO, formatDistanceToNow } from 'date-fns';
import { motion } from 'framer-motion';
import {
  ArrowLeft,
  Calendar,
  CheckCircle,
  Clock,
  DollarSign,
  Edit,
  Eye,
  Mail,
  MapPin,
  Package,
  Phone,
  Play,
  Plus,
  QrCode,
  Send,
  Trash2,
  User,
  History,
  Wand2,
  ExternalLink,
  Users,
  Upload,
} from 'lucide-react';
import { AppLayout } from '@/components/layout/AppLayout';
import { RecommendCrewDialog } from '@/components/RecommendCrewDialog';
import { SendPortalLinkButton } from '@/components/client/SendPortalLinkButton';
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
import { useEvent, useEventAssignments, useDeleteEvent, useUpdateEvent, type EventAssignment } from '@/hooks/useEvents';
import { useEventSessions } from '@/hooks/useEventSessions';
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
import { EventBudgetCard } from '@/components/EventBudgetCard';
import { EventQuotesPanel } from '@/components/EventQuotesPanel';
import { EventFinancialsCard } from '@/components/EventFinancialsCard';
import { MailHistoryPanel } from '@/components/MailHistoryPanel';
import { Badge } from '@/components/ui/badge';
import { EventContactsCard } from '@/components/EventContactsCard';
import { StaffWorkflowPanel } from '@/components/StaffWorkflowPanel';
import { EventDocumentsPanel } from '@/components/EventDocumentsPanel';
import { useEventSectionVisibility } from '@/hooks/useRoleSectionVisibility';
import { EventQrPanel } from '@/components/EventQrPanel';
import { EventBriefPanel } from '@/components/EventBriefPanel';
import { ClientBriefPanel } from '@/components/ClientBriefPanel';
import { SendFinalConfirmationDialog } from '@/components/SendFinalConfirmationDialog';
import { useSendNotification } from '@/hooks/useNotifications';
import { useEventEmailActionStatuses, getActionStatusDisplay } from '@/hooks/useEventEmailActionStatus';
import { getPublicBaseUrl, cn } from '@/lib/utils';
import { supabase } from '@/integrations/supabase/client';
import { useQueryClient, useQuery } from '@tanstack/react-query';
import { useToast } from '@/hooks/use-toast';
import { useStaffRoles } from '@/hooks/useStaff';
import { usePayRateCard, calculatePayFromRateCard, usePayAllowances } from '@/hooks/usePayRateCard';
import { useEditingInstructionTemplates } from '@/hooks/useEditingInstructionTemplates';
function formatSessionTime(timeStr: string): string {
  try {
    const [h, m] = timeStr.split(':');
    const hour = parseInt(h, 10);
    const ampm = hour >= 12 ? 'PM' : 'AM';
    const h12 = hour % 12 || 12;
    return `${h12}:${m} ${ampm}`;
  } catch {
    return timeStr;
  }
}

function EditingInstructionsPanel({ value, templateId, onSave }: { value: string; templateId?: string | null; onSave: (val: string, templateId?: string | null) => Promise<void> }) {
  const [editing, setEditing] = useState(false);
  const [text, setText] = useState(value);
  const [saving, setSaving] = useState(false);
  const { toast } = useToast();
  const { data: templates = [] } = useEditingInstructionTemplates();

  const handleTemplateChange = async (tid: string) => {
    const template = templates.find((t) => t.id === tid);
    if (!template) return;
    setText(template.content);
    setSaving(true);
    try {
      await onSave(template.content, tid);
      toast({ title: 'Editing instructions applied from template' });
    } catch {
      toast({ variant: 'destructive', title: 'Failed to apply template' });
    } finally {
      setSaving(false);
    }
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      await onSave(text);
      setEditing(false);
      toast({ title: 'Editing instructions saved' });
    } catch {
      toast({ variant: 'destructive', title: 'Failed to save' });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="bg-card border border-border rounded-xl p-5 shadow-card">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <Edit className="h-5 w-5 text-muted-foreground" />
          <h3 className="font-display font-semibold">Editing Instructions</h3>
          <Badge variant="outline" className="text-xs">Internal</Badge>
        </div>
        {!editing && (
          <Button variant="ghost" size="sm" onClick={() => { setText(value); setEditing(true); }}>
            <Edit className="h-4 w-4 mr-1" /> Edit
          </Button>
        )}
      </div>
      {!editing && templates.length > 0 && (
        <div className="mb-3">
          <Select value={templateId || ''} onValueChange={handleTemplateChange}>
            <SelectTrigger className="w-full">
              <SelectValue placeholder="Apply a template..." />
            </SelectTrigger>
            <SelectContent>
              {templates.map((t) => (
                <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      )}
      {editing ? (
        <div className="space-y-2">
          <textarea
            className="w-full min-h-[120px] rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="Enter editing instructions for the post-production team..."
          />
          <div className="flex gap-2 justify-end">
            <Button variant="outline" size="sm" onClick={() => setEditing(false)}>Cancel</Button>
            <Button size="sm" onClick={handleSave} disabled={saving}>
              {saving ? 'Saving...' : 'Save'}
            </Button>
          </div>
        </div>
      ) : (
        <p className="text-sm text-muted-foreground whitespace-pre-wrap">
          {value || 'No editing instructions set.'}
        </p>
      )}
    </div>
  );
}

function AssignmentBudgetLine({ assignment, eventId, isAdmin }: { assignment: EventAssignment; eventId: string; isAdmin: boolean }) {
  const { data: rateCard = [], isLoading } = usePayRateCard();
  const { data: allAllowances = [] } = usePayAllowances();
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [addingExtra, setAddingExtra] = useState(false);

  // Fetch assignment allowances
  const { data: assignmentAllowances = [] } = useQuery({
    queryKey: ['assignment-allowances', assignment.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('assignment_allowances')
        .select('*, pay_allowances:allowance_id(id, name, amount, unit)')
        .eq('assignment_id', assignment.id);
      if (error) throw error;
      return data as any[];
    },
  });

  const roleId = assignment.staff_role_id;
  const rateEntry = rateCard.find(r => r.staff_role_id === roleId);

  if (isLoading || !rateEntry) return null;

  // Calculate session duration in hours
  const session = (assignment as any).session;
  let sessionHours: number | null = null;
  if (session?.start_time && session?.end_time) {
    const [sh, sm] = session.start_time.split(':').map(Number);
    const [eh, em] = session.end_time.split(':').map(Number);
    sessionHours = (eh * 60 + em - (sh * 60 + sm)) / 60;
    if (sessionHours <= 0) sessionHours = null;
  }

  const callHours = sessionHours ? Math.ceil(sessionHours) : rateEntry.minimum_paid_hours;
  const basePay = sessionHours
    ? calculatePayFromRateCard(rateEntry.hourly_rate, rateEntry.minimum_paid_hours, sessionHours)
    : rateEntry.hourly_rate * (rateEntry.minimum_paid_hours + 1);

  // Calculate extras total
  const extrasTotal = assignmentAllowances.reduce((sum: number, aa: any) => {
    const amt = aa.override_amount ?? aa.pay_allowances?.amount ?? 0;
    const qty = aa.quantity || 1;
    return sum + amt * qty;
  }, 0);

  const totalWithExtras = basePay + extrasTotal;

  const activeAllowanceIds = new Set(assignmentAllowances.map((aa: any) => aa.allowance_id || aa.pay_allowances?.id));
  const availableExtras = allAllowances.filter(a => a.is_active && !activeAllowanceIds.has(a.id));

  const handleAddExtra = async (allowanceId: string) => {
    const { error } = await supabase.from('assignment_allowances').insert({
      assignment_id: assignment.id,
      allowance_id: allowanceId,
      quantity: 1,
    });
    if (error) {
      toast({ title: 'Failed to add extra', description: error.message, variant: 'destructive' });
    } else {
      queryClient.invalidateQueries({ queryKey: ['assignment-allowances', assignment.id] });
    }
    setAddingExtra(false);
  };

  const handleRemoveExtra = async (id: string) => {
    const { error } = await supabase.from('assignment_allowances').delete().eq('id', id);
    if (error) {
      toast({ title: 'Failed to remove', description: error.message, variant: 'destructive' });
    } else {
      queryClient.invalidateQueries({ queryKey: ['assignment-allowances', assignment.id] });
    }
  };

  return (
    <div className="mt-2 pt-2 border-t border-border space-y-1">
      <div className="flex items-center gap-2">
        <DollarSign className="h-3.5 w-3.5 text-muted-foreground" />
        <span className="text-xs text-muted-foreground">
          Pay: <span className="font-medium text-foreground">
            ${rateEntry.hourly_rate.toFixed(2)}/hr × {callHours + 1}hrs = ${basePay.toFixed(2)}
          </span>
        </span>
      </div>

      {/* Extras */}
      {assignmentAllowances.map((aa: any) => {
        const name = aa.pay_allowances?.name || 'Extra';
        const amt = aa.override_amount ?? aa.pay_allowances?.amount ?? 0;
        return (
          <div key={aa.id} className="flex items-center gap-2 pl-5">
            <span className="text-xs text-muted-foreground">
              + {name}: <span className="font-medium text-foreground">${(amt * (aa.quantity || 1)).toFixed(2)}</span>
            </span>
            {isAdmin && (
              <Button variant="ghost" size="icon" className="h-5 w-5 text-muted-foreground hover:text-destructive" onClick={() => handleRemoveExtra(aa.id)}>
                <Trash2 className="h-3 w-3" />
              </Button>
            )}
          </div>
        );
      })}

      {/* Add extras button */}
      {isAdmin && availableExtras.length > 0 && (
        addingExtra ? (
          <div className="pl-5">
            <Select onValueChange={handleAddExtra}>
              <SelectTrigger className="h-7 text-xs w-48">
                <SelectValue placeholder="Select extra..." />
              </SelectTrigger>
              <SelectContent>
                {availableExtras.map(a => (
                  <SelectItem key={a.id} value={a.id}>
                    {a.name} (${a.amount.toFixed(2)}{a.unit === 'per_hour' ? '/hr' : ''})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        ) : (
          <button className="text-xs text-primary hover:underline pl-5 flex items-center gap-1" onClick={() => setAddingExtra(true)}>
            <Plus className="h-3 w-3" /> Add extra
          </button>
        )
      )}

      {/* Total with extras */}
      {extrasTotal > 0 && isAdmin && (
        <div className="flex items-center gap-2 pt-1 border-t border-border/50">
          <DollarSign className="h-3.5 w-3.5 text-muted-foreground" />
          <span className="text-xs font-medium">
            Total: ${totalWithExtras.toFixed(2)}
          </span>
        </div>
      )}
    </div>
  );
}

function AssignmentCard({ assignment, eventId, isAdmin }: { assignment: EventAssignment; eventId: string; isAdmin: boolean }) {
  const sendNotification = useSendNotification();
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [editingRole, setEditingRole] = useState(false);
  const { data: staffRoles = [] } = useStaffRoles();

  const name = assignment.profile?.full_name || assignment.staff?.name || 'Unknown';
  const role = assignment.staff_role?.name || assignment.role_on_event || assignment.staff?.role || 'Staff';
  const initial = name.charAt(0).toUpperCase();
  const confirmationStatus = assignment.confirmation_status || 'pending';

  const handleRoleChange = async (newRoleId: string) => {
    const { error } = await supabase
      .from('event_assignments')
      .update({ staff_role_id: newRoleId })
      .eq('id', assignment.id);
    if (error) {
      toast({ title: 'Failed to update role', description: error.message, variant: 'destructive' });
    } else {
      queryClient.invalidateQueries({ queryKey: ['event-assignments', eventId] });
      toast({ title: 'Role updated' });
    }
    setEditingRole(false);
  };

  return (
    <div className="flex flex-col p-4 bg-muted/50 rounded-lg">
      <div className="flex items-start gap-3">
        <div className="w-12 h-12 rounded-full bg-primary/20 flex items-center justify-center shrink-0">
          <span className="text-lg font-medium text-primary">{initial}</span>
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <Link to={`/staff/${assignment.user_id || assignment.staff_id}`} className="font-medium truncate hover:underline text-primary">
              {name}
            </Link>
            <Badge
              variant={confirmationStatus === 'confirmed' ? 'default' : confirmationStatus === 'declined' ? 'destructive' : 'secondary'}
              className="text-xs shrink-0"
            >
              {confirmationStatus === 'confirmed' ? 'Confirmed' : confirmationStatus === 'declined' ? 'Declined' : 'Pending'}
            </Badge>
          </div>
          {isAdmin && editingRole ? (
            <Select
              defaultValue={assignment.staff_role_id || ''}
              onValueChange={handleRoleChange}
              onOpenChange={(open) => { if (!open) setEditingRole(false); }}
            >
              <SelectTrigger className="h-7 w-48 text-xs mt-0.5">
                <SelectValue placeholder="Select role" />
              </SelectTrigger>
              <SelectContent>
                {staffRoles.map((r) => (
                  <SelectItem key={r.id} value={r.id}>{r.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          ) : (
            <p
              className={`text-sm text-muted-foreground capitalize ${isAdmin ? 'cursor-pointer hover:text-primary transition-colors' : ''}`}
              onClick={() => isAdmin && setEditingRole(true)}
              title={isAdmin ? 'Click to change role' : undefined}
            >
              {role}
            </p>
          )}
          {assignment.assignment_notes && (
            <p className="text-xs text-muted-foreground mt-1 truncate">{assignment.assignment_notes}</p>
          )}
        </div>
        {isAdmin && (
          <div className="flex items-center gap-1 shrink-0">
            {confirmationStatus !== 'confirmed' && (
              <Button
                variant="outline"
                size="sm"
                className="h-8"
                onClick={async () => {
                  const { data: updated, error } = await supabase
                    .from('event_assignments')
                    .update({ confirmation_status: 'confirmed', confirmed_at: new Date().toISOString() })
                    .eq('id', assignment.id)
                    .select();
                  if (error) {
                    toast({ title: 'Failed to confirm', description: error.message, variant: 'destructive' });
                  } else if (!updated || updated.length === 0) {
                    toast({ title: 'Failed to confirm', description: 'No rows updated. Check permissions.', variant: 'destructive' });
                  } else {
                    queryClient.invalidateQueries({ queryKey: ['event-assignments', eventId] });
                    toast({ title: 'Marked as confirmed' });
                  }
                }}
                title="Mark as confirmed"
              >
                <CheckCircle className="h-4 w-4" />
              </Button>
            )}
            <Button
              variant="outline"
              size="sm"
              className="h-8"
              onClick={() => {
                const userId = assignment.user_id || assignment.staff?.id;
                if (!userId) return;
                sendNotification.mutate({
                  type: 'assignment',
                  event_id: eventId,
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
          </div>
        )}
      </div>
      <AssignmentBudgetLine assignment={assignment} eventId={eventId} isAdmin={isAdmin} />
      <StaffWorkflowPanel eventId={eventId} assignment={assignment} />
    </div>
  );
}

export default function EventDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { isAdmin, isSales, isOperations, isCrew, user } = useAuth();
  const { canSeeSection } = useEventSectionVisibility();
  const { data: event, isLoading } = useEvent(id);
  const { data: assignments = [] } = useEventAssignments(id);
  const { data: eventSessions = [] } = useEventSessions(id);
  const { data: emailStatuses } = useEventEmailActionStatuses(id);
  const { data: eventTypes = [] } = useEventTypes();
  const { data: deliveryMethods = [] } = useDeliveryMethods();
  const { data: auditLog = [] } = useAuditLog(id);
  const deleteEvent = useDeleteEvent();
  const updateEvent = useUpdateEvent();
  const sendNotification = useSendNotification();
  const queryClient = useQueryClient();
  const { toast } = useToast();
  // Status update state
  const [isUpdatingStatus, setIsUpdatingStatus] = useState(false);
  const [recommendCrewOpen, setRecommendCrewOpen] = useState(false);
  const [sendEmailOpen, setSendEmailOpen] = useState(false);
  const [isSendingTeamUpdate, setIsSendingTeamUpdate] = useState(false);
  const [finalConfirmOpen, setFinalConfirmOpen] = useState(false);
  const [liveAccessOpen, setLiveAccessOpen] = useState(false);
  const [dropboxEmailOpen, setDropboxEmailOpen] = useState(false);
  const [requestFilesOpen, setRequestFilesOpen] = useState(false);

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
  
  // Resolve primary contact email for contracts/emails
  // Priority: event_contacts (primary) > client.primary_contact_email > company_email
  const primaryContactEmail = useMemo(() => {
    // First try primary event contact
    const primaryContact = eventContacts.find((c: any) => c.contact_type === 'primary');
    if (primaryContact) {
      return primaryContact.contact_email || primaryContact.client_contact?.email;
    }
    // Fall back to any event contact with email
    const anyContact = eventContacts.find((c: any) => c.contact_email || c.client_contact?.email);
    if (anyContact) {
      return anyContact.contact_email || anyContact.client_contact?.email;
    }
    // Fall back to client primary contact email
    const client = (event?.client_id ? (event as any).clients : clientByName) as any;
    return client?.primary_contact_email || client?.company_email || null;
  }, [eventContacts, event, clientByName]);
  
  const primaryContactName = useMemo(() => {
    const primaryContact = eventContacts.find((c: any) => c.contact_type === 'primary');
    if (primaryContact) {
      return primaryContact.contact_name || primaryContact.client_contact?.contact_name;
    }
    const anyContact = eventContacts.find((c: any) => c.contact_name || c.client_contact?.contact_name);
    if (anyContact) {
      return anyContact.contact_name || anyContact.client_contact?.contact_name;
    }
    const client = (event?.client_id ? (event as any).clients : clientByName) as any;
    return client?.primary_contact_name || (event as any)?.client_name || null;
  }, [eventContacts, event, clientByName]);

  // Helper to get event type name
  const getEventTypeName = () => {
    if (!event) return '';
    if (event.event_type_id && eventTypeMap[event.event_type_id]) {
      return eventTypeMap[event.event_type_id];
    }
    return event.event_type?.replace('_', ' ') || 'Other';
  };

  // Helper to get delivery method name
  const getDeliveryMethodName = (field: 'delivery_method_id' | 'delivery_method_guests_id' = 'delivery_method_id') => {
    if (!event) return '';
    const fieldId = event[field];
    if (fieldId && deliveryMethodMap[fieldId]) {
      return deliveryMethodMap[fieldId];
    }
    if (field === 'delivery_method_id') {
      return event.delivery_method?.replace('_', ' ') || '';
    }
    return '';
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
            to={event.event_series_id ? `/admin/series/${event.event_series_id}` : "/events"}
            className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground mb-3"
          >
            <ArrowLeft className="h-4 w-4" />
            {event.event_series_id ? 'Back to Series' : 'Back to Events'}
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
        {(isAdmin || isOperations || isSales) && (
          <div className="flex items-center gap-2">
            <Link to={`/events/${id}/edit`}>
              <Button variant="outline">
                <Edit className="h-4 w-4 mr-2" />
                Edit
              </Button>
            </Link>
            {isAdmin && (
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
            )}
          </div>
        )}
      </div>

      <Tabs defaultValue="overview" className="space-y-6">
        <TabsList>
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="assignments">Assignments</TabsTrigger>
          {(isAdmin || canSeeSection('equipment_tab')) && (
            <TabsTrigger value="equipment">
              <Package className="h-4 w-4 mr-1" />
              Equipment
            </TabsTrigger>
          )}
          {canSeeSection('activity_tab') && <TabsTrigger value="activity">Activity</TabsTrigger>}
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

                  {/* Delivery Method - Client */}
                  <div className="flex items-start gap-3">
                    <div className="p-2 bg-primary/10 rounded-lg">
                      <Package className="h-4 w-4 text-primary" />
                    </div>
                    <div className="flex-1">
                      <p className="text-sm text-muted-foreground">Delivery Method - Client</p>
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
                        <p className="font-medium capitalize">{getDeliveryMethodName('delivery_method_id') || 'Not set'}</p>
                      )}
                    </div>
                  </div>

                  {/* Delivery Method - Guests */}
                  <div className="flex items-start gap-3">
                    <div className="p-2 bg-primary/10 rounded-lg">
                      <Package className="h-4 w-4 text-primary" />
                    </div>
                    <div className="flex-1">
                      <p className="text-sm text-muted-foreground">Delivery Method - Guests</p>
                      {isAdmin ? (
                        <Select
                          value={event.delivery_method_guests_id || ''}
                          onValueChange={async (value) => {
                            setIsUpdatingStatus(true);
                            await updateEvent.mutateAsync({
                              id: event.id,
                              delivery_method_guests_id: value,
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
                        <p className="font-medium capitalize">{getDeliveryMethodName('delivery_method_guests_id') || 'Not set'}</p>
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
              {id && canSeeSection('sessions') && (
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
              {canSeeSection('contacts') && (
                <EventContactsCard
                  eventId={id!}
                  clientId={event?.client_id || (clientByName as any)?.id || null}
                  clientName={event.client_name}
                  clientDetails={(event?.client_id ? (event as any).clients : clientByName) as any}
                  onsiteContact={{
                    name: event.onsite_contact_name,
                    phone: event.onsite_contact_phone,
                  }}
                  onClearOnsiteContact={async () => {
                    await supabase
                      .from('events')
                      .update({ onsite_contact_name: null, onsite_contact_phone: null })
                      .eq('id', id!);
                    queryClient.invalidateQueries({ queryKey: ['event', id] });
                  }}
                />
              )}
              {/* Coverage, Photography Instructions & Notes */}
              {canSeeSection('additional_details') && (event.coverage_details || (event as any).photography_brief || event.notes) && (
                <div className="bg-card border border-border rounded-xl p-5 shadow-card">
                  <div className="flex items-center justify-between mb-4">
                    <h2 className="text-lg font-display font-semibold">Additional Details</h2>
                    <Button variant="outline" size="sm" onClick={() => navigate(`/events/${id}/edit`)}>
                      <ExternalLink className="h-4 w-4 mr-1" />
                      Edit
                    </Button>
                  </div>
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
              
              {/* QR for this Event */}
              {id && canSeeSection('qr_panel') && (
                <EventQrPanel
                  eventId={id}
                  qrFilePath={(event as any).qr_file_path || null}
                  qrFileName={(event as any).qr_file_name || null}
                  preRegistrationLink={(event as any).pre_registration_link || null}
                  dropboxLink={(event as any).dropbox_link || null}
                  smugmugLink={(event as any).smugmug_link || null}
                  isAdmin={isAdmin || isOperations || isSales}
                />
              )}
              
              {/* Team Brief (internal) */}
              {id && canSeeSection('team_brief') && (
                <EventBriefPanel
                  eventId={id}
                  briefTemplateId={(event as any).brief_template_id}
                  briefContent={(event as any).brief_content}
                  isAdmin={isAdmin}
                />
              )}

              {/* Event Brief (shared with client) */}
              {id && canSeeSection('client_brief') && (
                <ClientBriefPanel
                  eventId={id}
                  clientBriefContent={(event as any).client_brief_content}
                  clientBriefTemplateId={(event as any).client_brief_template_id}
                  isAdmin={isAdmin}
                />
              )}
            </motion.div>

            {/* Column 2: Status, Mail History */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.05 }}
              className="space-y-6"
            >
              {/* Status */}
              {(isAdmin || canSeeSection('status')) && (
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
                          <SelectItem value="confirmed">Confirmed</SelectItem>
                          <SelectItem value="ready">Ready</SelectItem>
                          <SelectItem value="in_progress">In Progress</SelectItem>
                          <SelectItem value="delivered">Delivered</SelectItem>
                          <SelectItem value="completed">Completed</SelectItem>
                          <SelectItem value="archived">Archived</SelectItem>
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
                    <div className="space-y-2">
                      <Label htmlFor="xero_tag">Xero Tag</Label>
                      <Input
                        id="xero_tag"
                        placeholder="e.g., 260419 Stihl"
                        defaultValue={(event as any).xero_tag || ''}
                        onBlur={async (e) => {
                          const value = e.target.value;
                          if (value !== (event as any).xero_tag) {
                            setIsUpdatingStatus(true);
                            await updateEvent.mutateAsync({
                              id: event.id,
                              xero_tag: value || null,
                            });
                            setIsUpdatingStatus(false);
                          }
                        }}
                        disabled={isUpdatingStatus}
                      />
                      <p className="text-xs text-muted-foreground">
                        6-digit code + event name for Xero expense sync
                      </p>
                    </div>
                  </div>
                </div>
              )}


              {/* Event Financials - above Contracts */}
              {(isAdmin || canSeeSection('financials')) && id && (
                <EventFinancialsCard eventId={id} />
              )}

              {/* Budget (Quote) Panel */}
              {(isAdmin || canSeeSection('budget')) && (event as any).quote_id && (
                <EventBudgetCard quoteId={(event as any).quote_id} leadId={(event as any).lead_id} />
              )}

              {/* Event Documents */}
              {id && (
                <EventDocumentsPanel eventId={id} isAdmin={isAdmin} />
              )}

              {/* Contracts Panel */}
              {(isAdmin || canSeeSection('contracts')) && id && event.client_id && (
                <ContractsPanel
                  eventId={id}
                  clientId={event.client_id}
                  clientName={primaryContactName || (event as any).client_name}
                  clientEmail={primaryContactEmail}
                  quoteId={(event as any).quote_id}
                  eventName={(event as any).event_name}
                  eventDate={(event as any).event_date}
                  defaultOpen={true}
                />
              )}

              {/* Quotes Panel */}
              {(isAdmin || canSeeSection('quotes')) && (
                <EventQuotesPanel
                  eventId={id!}
                  quoteId={(event as any).quote_id}
                  leadId={(event as any).lead_id}
                />
              )}
            </motion.div>

            {/* Column 3: Quick Actions, Workflow, Tasks, Contracts */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 }}
              className="space-y-6"
            >
              {/* Quick Actions */}
              {canSeeSection('quick_actions') && <div className="bg-card border border-border rounded-xl p-5 shadow-card">
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
                  {(isAdmin || isOperations) && (
                    <Button
                      variant="outline"
                      className="w-full justify-start"
                      onClick={() => {
                        const token = event.client_portal_token;
                        if (token) {
                          const baseUrl = getPublicBaseUrl();
                          window.open(`${baseUrl}/event/${token}`, '_blank');
                        } else {
                          toast({ title: 'Portal token not found', description: 'Try refreshing the page.', variant: 'destructive' });
                        }
                      }}
                    >
                      <Eye className="h-4 w-4 mr-2" />
                      View as Client
                    </Button>
                  )}
                  {(isAdmin || isOperations) && event?.quote_id && (
                    <Link to={`/sales/quotes/${event.quote_id}`} className="block">
                      <Button variant="outline" className="w-full justify-start">
                        <DollarSign className="h-4 w-4 mr-2" />
                        View Budget
                      </Button>
                    </Link>
                  )}
                  {(isAdmin || isOperations) && (
                    <Button variant="outline" className="w-full justify-between" onClick={() => setSendEmailOpen(true)}>
                      <span className="flex items-center">
                        <Mail className="h-4 w-4 mr-2" />
                        Send Email
                      </span>
                      {emailStatuses && (
                        <Badge variant="outline" className={cn('text-[10px] px-1.5 py-0', getActionStatusDisplay(emailStatuses.send_email.status).className)}>
                          {getActionStatusDisplay(emailStatuses.send_email.status).label}
                        </Badge>
                      )}
                    </Button>
                  )}
                  {(isAdmin || isOperations) && (
                    <Button variant="outline" className="w-full justify-between" onClick={() => setFinalConfirmOpen(true)}>
                      <span className="flex items-center">
                        <CheckCircle className="h-4 w-4 mr-2" />
                        Send Final Confirmation
                      </span>
                      {emailStatuses && (
                        <Badge variant="outline" className={cn('text-[10px] px-1.5 py-0', getActionStatusDisplay(emailStatuses.final_confirmation.status).className)}>
                          {getActionStatusDisplay(emailStatuses.final_confirmation.status).label}
                        </Badge>
                      )}
                    </Button>
                  )}
                  {(isAdmin || isOperations) && (event as any).pre_registration_link && (
                    <Button variant="outline" className="w-full justify-start" onClick={() => setLiveAccessOpen(true)}>
                      <QrCode className="h-4 w-4 mr-2" />
                      <span className="flex-1 text-left">Send Live Access</span>
                      {emailStatuses && (
                        <Badge variant="outline" className={cn('text-[10px] px-1.5 py-0', getActionStatusDisplay(emailStatuses.live_access.status).className)}>
                          {getActionStatusDisplay(emailStatuses.live_access.status).label}
                        </Badge>
                      )}
                    </Button>
                  )}
                  {(isAdmin || isOperations) && (event as any).dropbox_link && primaryContactEmail && (
                    <Button
                      variant="outline"
                      className="w-full justify-between"
                      onClick={() => setDropboxEmailOpen(true)}
                    >
                      <span className="flex items-center">
                        <Package className="h-4 w-4 mr-2" />
                        Send Dropbox Link
                      </span>
                      {emailStatuses && (
                        <Badge variant="outline" className={cn('text-[10px] px-1.5 py-0', getActionStatusDisplay(emailStatuses.dropbox_delivery.status).className)}>
                          {getActionStatusDisplay(emailStatuses.dropbox_delivery.status).label}
                        </Badge>
                      )}
                    </Button>
                  )}
                  {(isAdmin || isOperations) && event?.client_id && (primaryContactEmail || eventContacts.length > 0) && (
                    <div className="flex items-center gap-2">
                      <SendPortalLinkButton
                        clientId={event.client_id}
                        clientName={(event as any)?.client_name || ''}
                        contactEmail={primaryContactEmail}
                        contactName={primaryContactName}
                        eventId={event.id}
                        contacts={eventContacts
                          .filter(c => {
                            const email = c.contact_email || c.client_contact?.email;
                            return !!email;
                          })
                          .map(c => ({
                            name: c.contact_name || c.client_contact?.contact_name || null,
                            email: (c.contact_email || c.client_contact?.email)!,
                          }))
                        }
                        className="flex-1 justify-start"
                        buttonSize="default"
                      />
                      {emailStatuses && (
                        <Badge variant="outline" className={cn('text-[10px] px-1.5 py-0 shrink-0', getActionStatusDisplay(emailStatuses.portal_link.status).className)}>
                          {getActionStatusDisplay(emailStatuses.portal_link.status).label}
                        </Badge>
                      )}
                    </div>
                  )}
                  {(isAdmin || isOperations) && assignments.length > 0 && (
                    <Button 
                      variant="outline" 
                      className="w-full justify-between" 
                      disabled={isSendingTeamUpdate}
                      onClick={async () => {
                        setIsSendingTeamUpdate(true);
                        try {
                          await sendNotification.mutateAsync({
                            type: 'event_update',
                            event_id: id!,
                          });
                        } finally {
                          setIsSendingTeamUpdate(false);
                        }
                      }}
                    >
                      <span className="flex items-center">
                        <Users className="h-4 w-4 mr-2" />
                        {isSendingTeamUpdate ? 'Sending...' : 'Send Updated Details to Team'}
                      </span>
                      {emailStatuses && (
                        <Badge variant="outline" className={cn('text-[10px] px-1.5 py-0', getActionStatusDisplay(emailStatuses.team_update.status).className)}>
                          {getActionStatusDisplay(emailStatuses.team_update.status).label}
                        </Badge>
                      )}
                    </Button>
                    )}
                  {(isAdmin || isOperations) && assignments.length > 0 && (
                    <Button
                      variant="outline"
                      className="w-full justify-between"
                      onClick={() => setRequestFilesOpen(true)}
                    >
                      <span className="flex items-center">
                        <Upload className="h-4 w-4 mr-2" />
                        Request Files
                      </span>
                      {emailStatuses?.request_files && (
                        <Badge variant="outline" className={cn('text-[10px] px-1.5 py-0', getActionStatusDisplay(emailStatuses.request_files.status).className)}>
                          {getActionStatusDisplay(emailStatuses.request_files.status).label}
                        </Badge>
                      )}
                    </Button>
                  )}
                </div>
              </div>}

              {/* Workflow Rail - Admin/Sales/Ops see full rail; Crew see their own tasks */}
              {canSeeSection('workflow') && (isAdmin || isSales || isOperations) && id && (
                <div className="space-y-2">
                  {isAdmin && (
                    <div className="flex items-center justify-between">
                      <InitializeWorkflowDialog 
                        eventId={id} 
                        currentTemplateId={(event as any).workflow_template_id}
                      />
                    </div>
                  )}
                  <JobWorkflowRail eventId={id} isAdmin={isAdmin} />
                </div>
              )}
              {isCrew && !isAdmin && !isSales && !isOperations && id && user && (() => {
                const myAssignment = assignments.find(a => a.user_id === user.id);
                if (!myAssignment) return null;
                return (
                  <div className="space-y-2">
                    <h3 className="text-sm font-semibold">My Workflow</h3>
                    <StaffWorkflowPanel eventId={id} assignment={myAssignment} />
                  </div>
                );
              })()}

              {/* Editing Instructions - Internal Only */}
              {(isAdmin || canSeeSection('editing_instructions')) && id && (
                <EditingInstructionsPanel
                  value={(event as any)?.editing_instructions || ''}
                  templateId={(event as any)?.editing_instructions_template_id}
                  onSave={async (val: string, tid?: string | null) => {
                    const updateData: any = { editing_instructions: val };
                    if (tid !== undefined) updateData.editing_instructions_template_id = tid;
                    await supabase.from('events').update(updateData).eq('id', id);
                    queryClient.invalidateQueries({ queryKey: ['events', id] });
                  }}
                />
              )}

              {/* Mail History */}
              {(isAdmin || canSeeSection('mail_history')) && id && (
                <MailHistoryPanel eventId={id} maxItems={5} />
              )}

              {/* Setup Tasks */}
              {(isAdmin || canSeeSection('tasks')) && id && <EventTasksCard eventId={id} />}

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
              <div className="space-y-6">
                {/* General (all-session) assignments */}
                {(() => {
                  const generalAssignments = assignments.filter(a => !a.session_id);
                  const hasSessions = eventSessions.length > 0;
                  
                  if (generalAssignments.length > 0) {
                    return (
                      <div>
                        {hasSessions && (
                          <h3 className="text-sm font-medium text-muted-foreground uppercase tracking-wide mb-3">All Sessions</h3>
                        )}
                        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
                          {generalAssignments.map(assignment => (
                            <AssignmentCard key={assignment.id} assignment={assignment} eventId={id!} isAdmin={isAdmin} />
                          ))}
                        </div>
                      </div>
                    );
                  }
                  return null;
                })()}

                {/* Per-session grouped assignments */}
                {eventSessions.map(session => {
                  const sessionAssigns = assignments.filter(a => a.session_id === session.id);
                  return (
                    <div key={session.id} className="border border-border rounded-lg p-4">
                      <div className="flex items-center gap-2 mb-3">
                        <Calendar className="h-4 w-4 text-primary" />
                        <h3 className="text-sm font-medium">
                          {format(parseISO(session.session_date), 'EEE, d MMM yyyy')}
                        </h3>
                        {session.start_time && (
                          <span className="text-xs text-muted-foreground">
                            {formatSessionTime(session.start_time)}
                            {session.end_time ? ` – ${formatSessionTime(session.end_time)}` : ''}
                          </span>
                        )}
                        {session.label && (
                          <Badge variant="outline" className="text-xs">{session.label}</Badge>
                        )}
                      </div>
                      {sessionAssigns.length === 0 ? (
                        <p className="text-xs text-muted-foreground italic pl-6">No crew assigned to this session</p>
                      ) : (
                        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
                          {sessionAssigns.map(assignment => (
                            <AssignmentCard key={assignment.id} assignment={assignment} eventId={id!} isAdmin={isAdmin} />
                          ))}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </TabsContent>

        {/* Equipment Tab */}
        {(isAdmin || canSeeSection('equipment_tab')) && id && (
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

      {/* Final Confirmation Dialog */}
      {id && event && (
        <SendFinalConfirmationDialog
          open={finalConfirmOpen}
          onOpenChange={setFinalConfirmOpen}
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
            primary_contact_name: primaryContactName,
            primary_contact_phone: primaryContactEmail,
            delivery_method: getDeliveryMethodName('delivery_method_id'),
            delivery_method_guests: getDeliveryMethodName('delivery_method_guests_id'),
            arrival_time: eventSessions[0]?.arrival_time || null,
            client_brief_content: (event as any).client_brief_content,
          }}
          recipients={emailRecipients}
          assignments={assignments}
          sessions={eventSessions}
        />
      )}

      {/* Send Live Access Dialog */}
      {id && event && (
        <SendOpsEmailDialog
          open={liveAccessOpen}
          onOpenChange={setLiveAccessOpen}
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
          initialSubject={`Live Access Details – ${event.event_name} – ${event.event_date ? format(parseISO(event.event_date), 'EEEE d MMMM yyyy') : ''}`}
          initialBody={(() => {
            const regLink = (event as any).pre_registration_link || '';
            return `<p>Hi {{client_name}},</p>` +
              `<p>Here are your links to access photos via RealTime delivery for ${event.event_name}.</p>` +
              ((event as any).qr_file_path
                ? `<p>The QR code (attached) can be printed and displayed at the event so your guests can scan it to register and access their photos instantly.</p>`
                : `<p>The QR code (provided separately) can be printed and displayed at the event so your guests can scan it to register and access their photos instantly.</p>`) +
              (regLink ? `<p>This link can be used by your social media manager or team to access all photos during the event:<br/><a href="${regLink}">${regLink}</a></p>` : '') +
              `<p>If you have any questions, please don't hesitate to get in touch.</p>` +
              `<p>Kind regards,<br/>The Eventpix Team</p>`;
          })()}
          storageAttachments={
            (event as any).qr_file_path
              ? [{ bucket: 'event-documents', path: (event as any).qr_file_path, fileName: (event as any).qr_file_name || 'QR-Code.pdf' }]
              : undefined
          }
        />
      )}

      {/* Send Dropbox Link Dialog */}
      {id && event && (event as any).dropbox_link && (
        <SendOpsEmailDialog
          open={dropboxEmailOpen}
          onOpenChange={setDropboxEmailOpen}
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
          initialSubject={`Your photos are ready – ${event.event_name}`}
          initialBody={(() => {
            const dropboxLink = (event as any).dropbox_link;
            const smugmugLink = (event as any).smugmug_link;
            let body = `<p>Hi {{client_name}},</p>` +
              `<p>Thank you for having EventPix cover your event – <strong>${event.event_name}</strong> – the files have now been edited and uploaded to <a href="${dropboxLink}"><strong>Dropbox</strong></a>.</p>`;
            if (smugmugLink) {
              body += `<p>We have also created a <a href="${smugmugLink}"><strong>gallery</strong></a> for your guests to access.</p>`;
            }
            body += `<p>If you have any questions, please don't hesitate to get in touch.</p>` +
              `<p>Kind regards,<br/>The Eventpix Team</p>`;
            return body;
          })()}
        />
      )}

      {/* Request Files Dialog */}
      {id && event && assignments.length > 0 && (
        <SendOpsEmailDialog
          open={requestFilesOpen}
          onOpenChange={setRequestFilesOpen}
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
          recipients={emailRecipients.filter(r => r.type === 'photographer' || r.type === 'assistant')}
          
          initialSubject={`Request to upload files – ${event.event_name}`}
          initialBody={(() => {
            const eventDate = event.event_date ? format(parseISO(event.event_date), 'EEEE d MMMM yyyy') : '';
            return `<p>Hi,</p>` +
              `<p>Thank you for shooting <strong>${event.event_name}</strong>${eventDate ? ` on ${eventDate}` : ''}.</p>` +
              `<p>Please upload the event files to our portal at your earliest convenience:</p>` +
              `<p><a href="https://trevorsteam-portal-6373224367.portal.massive.io/"><strong>Upload Files Here</strong></a></p>` +
              `<p>If you have any questions, please don't hesitate to get in touch.</p>` +
              `<p>Kind regards,<br/>The EventPix Team</p>`;
          })()}
        />
      )}
    </AppLayout>
  );
}
