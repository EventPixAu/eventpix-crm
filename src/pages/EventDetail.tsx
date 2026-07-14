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
  Truck,
  User,
  History,
  Wand2,
  ExternalLink,
  Users,
  Upload,
  Loader2,
  Globe,
} from 'lucide-react';
import { AppLayout } from '@/components/layout/AppLayout';
import { RecommendCrewDialog } from '@/components/RecommendCrewDialog';
import { SendPortalLinkButton } from '@/components/client/SendPortalLinkButton';
import { Button } from '@/components/ui/button';
import { StatusBadge } from '@/components/ui/status-badge';
import { InvoiceStatusBadge } from '@/components/ui/invoice-status-badge';
import { OpsStatusBadge } from '@/components/ui/ops-status-badge';
import { CompanyStatusBadgeDropdown } from '@/components/lead/CompanyStatusBadgeDropdown';
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
import { ProposedServicesEditor } from '@/components/ProposedServicesEditor';
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
import { EventPaymentPanel } from '@/components/EventPaymentPanel';
import { EventFinancialsCard } from '@/components/EventFinancialsCard';
import { MailHistoryPanel } from '@/components/MailHistoryPanel';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { EventContactsCard } from '@/components/EventContactsCard';
import { EventDressCodeCard } from '@/components/EventDressCodeCard';
import { StaffWorkflowPanel } from '@/components/StaffWorkflowPanel';
import { EventDocumentsPanel } from '@/components/EventDocumentsPanel';
import { useEventSectionVisibility } from '@/hooks/useRoleSectionVisibility';
import { EventQrPanel } from '@/components/EventQrPanel';
import { EventBriefPanel } from '@/components/EventBriefPanel';
import { ClientBriefPanel } from '@/components/ClientBriefPanel';
import { SendFinalConfirmationDialog } from '@/components/SendFinalConfirmationDialog';
import { SendTeamUpdateDialog } from '@/components/SendTeamUpdateDialog';
import { useSendNotification } from '@/hooks/useNotifications';
import { useEventEmailActionStatuses, getActionStatusDisplay } from '@/hooks/useEventEmailActionStatus';
import { getPublicBaseUrl, cn } from '@/lib/utils';
import { supabase } from '@/lib/supabase';
import { setClientStatusAuto } from '@/lib/clientStatusAuto';
import { useQueryClient, useQuery, useMutation } from '@tanstack/react-query';
import { toast } from 'sonner';
import { useStaffRoles } from '@/hooks/useStaff';
import { usePayRateCard, calculatePayFromRateCard, usePayAllowances } from '@/hooks/usePayRateCard';
import { CrewChecklistsPanel } from '@/components/CrewChecklistsPanel';
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

// EditingInstructionsPanel removed — replaced by Crew Checklists panel on Assignments tab.

function AssignmentBudgetLine({ assignment, eventId, isAdmin, isOperations, isSelf }: { assignment: EventAssignment; eventId: string; isAdmin: boolean; isOperations?: boolean; isSelf?: boolean }) {
  const canView = isAdmin || isOperations || isSelf;
  const canEdit = isAdmin || isOperations;
  if (!canView) return null;
  const { data: rateCard = [], isLoading } = usePayRateCard();
  const { data: allAllowances = [] } = usePayAllowances();
  const { data: eventSessions = [] } = useEventSessions(eventId);
  const queryClient = useQueryClient();
  const [addingExtra, setAddingExtra] = useState(false);
  const [editingAllowanceId, setEditingAllowanceId] = useState<string | null>(null);
  const [editAmount, setEditAmount] = useState('');
  const [editingTravel, setEditingTravel] = useState(false);
  const [travelInput, setTravelInput] = useState('');

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

  // Calculate session duration in hours - use assignment's session, fallback to event sessions
  const session = (assignment as any).session;
  let sessionHours: number | null = null;
  if (session?.start_time && session?.end_time) {
    const [sh, sm] = session.start_time.split(':').map(Number);
    const [eh, em] = session.end_time.split(':').map(Number);
    sessionHours = (eh * 60 + em - (sh * 60 + sm)) / 60;
    if (sessionHours <= 0) sessionHours = null;
  }
  // Fallback: use longest event session when assignment has no linked session
  if (!sessionHours && eventSessions.length > 0) {
    for (const es of eventSessions) {
      if (es.start_time && es.end_time) {
        const [sh, sm] = es.start_time.split(':').map(Number);
        const [eh, em] = es.end_time.split(':').map(Number);
        const h = (eh * 60 + em - (sh * 60 + sm)) / 60;
        if (h > 0 && (sessionHours === null || h > sessionHours)) sessionHours = h;
      }
    }
  }

  // Enforce minimum paid hours (e.g. 2hr minimum call)
  const isFixedMode = (rateEntry as any).rate_mode === 'fixed';
  const hourlyRate = Number(rateEntry.hourly_rate) || 0;
  const fixedRate = Number((rateEntry as any).fixed_rate) || 0;
  const minHours = Number(rateEntry.minimum_paid_hours) || 0;
  const effectiveHours = Math.max(sessionHours || 0, minHours);
  const callHours = Math.ceil(effectiveHours);
  const basePay = isFixedMode ? fixedRate : hourlyRate * (callHours + 1);

  // Calculate extras total
  const extrasTotal = assignmentAllowances.reduce((sum: number, aa: any) => {
    const amt = aa.override_amount ?? aa.pay_allowances?.amount ?? 0;
    const qty = aa.quantity || 1;
    return sum + amt * qty;
  }, 0);

  const travel = Number((assignment as any).travel_amount || 0);
  const totalWithExtras = basePay + extrasTotal + travel;

  const activeAllowanceIds = new Set(assignmentAllowances.map((aa: any) => aa.allowance_id || aa.pay_allowances?.id));
  const availableExtras = allAllowances.filter(a => a.is_active && !activeAllowanceIds.has(a.id));

  const handleAddExtra = async (allowanceId: string) => {
    const { error } = await supabase.from('assignment_allowances').insert({
      assignment_id: assignment.id,
      allowance_id: allowanceId,
      quantity: 1,
    });
    if (error) {
      toast.error('Failed to add extra', { description: error.message });
    } else {
      queryClient.invalidateQueries({ queryKey: ['assignment-allowances', assignment.id] });
    }
    setAddingExtra(false);
  };

  const handleRemoveExtra = async (id: string) => {
    const { error } = await supabase.from('assignment_allowances').delete().eq('id', id);
    if (error) {
      toast.error('Failed to remove', { description: error.message });
    } else {
      queryClient.invalidateQueries({ queryKey: ['assignment-allowances', assignment.id] });
    }
  };

  const handleUpdateAmount = async (aaId: string, newAmount: number) => {
    const { error } = await supabase
      .from('assignment_allowances')
      .update({ override_amount: newAmount })
      .eq('id', aaId);
    if (error) {
      toast.error('Failed to update', { description: error.message });
    } else {
      queryClient.invalidateQueries({ queryKey: ['assignment-allowances', assignment.id] });
    }
    setEditingAllowanceId(null);
  };

  const handleUpdateNotes = async (aaId: string, notes: string) => {
    const { error } = await supabase
      .from('assignment_allowances')
      .update({ notes })
      .eq('id', aaId);
    if (error) {
      toast.error('Failed to update', { description: error.message });
    } else {
      queryClient.invalidateQueries({ queryKey: ['assignment-allowances', assignment.id] });
    }
  };

  const handleUpdateTravel = async (newAmount: number) => {
    const safe = isNaN(newAmount) || newAmount < 0 ? 0 : newAmount;
    const { error } = await supabase
      .from('event_assignments')
      .update({ travel_amount: safe })
      .eq('id', assignment.id);
    if (error) {
      toast.error('Failed to update travel', { description: error.message });
    } else {
      queryClient.invalidateQueries({ queryKey: ['event-assignments', eventId] });
    }
    setEditingTravel(false);
  };


  return (
    <div className="mt-2 pt-2 border-t border-border space-y-1">
      <div className="flex items-center gap-2">
        <DollarSign className="h-3.5 w-3.5 text-muted-foreground" />
        <span className="text-xs text-muted-foreground">
          Pay: <span className="font-medium text-foreground">
            {isFixedMode
              ? `$${fixedRate.toFixed(2)} fixed = $${basePay.toFixed(2)}`
              : `$${hourlyRate.toFixed(2)}/hr × ${callHours + 1}hrs = $${basePay.toFixed(2)}`}
          </span>
        </span>
      </div>

      {/* Travel (per-assignment manual amount) */}
      {(canEdit || travel > 0) && (
        <div className="flex items-center gap-2 pl-5">
          <span className="text-xs text-muted-foreground">
            + Travel:{' '}
            {canEdit && editingTravel ? (
              <span className="inline-flex items-center gap-1">
                $<input
                  type="number"
                  step="0.01"
                  min="0"
                  className="w-20 h-5 text-xs bg-background border border-border rounded px-1 text-foreground"
                  value={travelInput}
                  onChange={(e) => setTravelInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') handleUpdateTravel(parseFloat(travelInput) || 0);
                    if (e.key === 'Escape') setEditingTravel(false);
                  }}
                  onBlur={() => handleUpdateTravel(parseFloat(travelInput) || 0)}
                  autoFocus
                />
              </span>
            ) : (
              <button
                className={`font-medium text-foreground ${canEdit ? 'hover:text-primary hover:underline cursor-pointer' : ''}`}
                onClick={() => {
                  if (!canEdit) return;
                  setTravelInput(String(travel));
                  setEditingTravel(true);
                }}
                disabled={!canEdit}
              >
                ${travel.toFixed(2)}
              </button>
            )}
          </span>
        </div>
      )}

      {/* Extras */}
      {assignmentAllowances.map((aa: any) => {
        const name = aa.pay_allowances?.name || 'Extra';
        const amt = aa.override_amount ?? aa.pay_allowances?.amount ?? 0;
        const isEditing = editingAllowanceId === aa.id;
        return (
          <div key={aa.id} className="space-y-1">
            <div className="flex items-center gap-2 pl-5">
              <span className="text-xs text-muted-foreground">
                + {name}:{' '}
                {canEdit && isEditing ? (
                  <span className="inline-flex items-center gap-1">
                    $<input
                      type="number"
                      step="0.01"
                      className="w-20 h-5 text-xs bg-background border border-border rounded px-1 text-foreground"
                      value={editAmount}
                      onChange={(e) => setEditAmount(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') handleUpdateAmount(aa.id, parseFloat(editAmount) || 0);
                        if (e.key === 'Escape') setEditingAllowanceId(null);
                      }}
                      onBlur={() => handleUpdateAmount(aa.id, parseFloat(editAmount) || 0)}
                      autoFocus
                    />
                  </span>
                ) : (
                  <button
                    className={`font-medium text-foreground ${canEdit ? 'hover:text-primary hover:underline cursor-pointer' : ''}`}
                    onClick={() => {
                      if (!canEdit) return;
                      setEditingAllowanceId(aa.id);
                      setEditAmount(String(amt));
                    }}
                    disabled={!canEdit}
                  >
                    ${(amt * (aa.quantity || 1)).toFixed(2)}
                  </button>
                )}
              </span>
              {canEdit && (
                <Button variant="ghost" size="icon" className="h-5 w-5 text-muted-foreground hover:text-destructive" onClick={() => handleRemoveExtra(aa.id)}>
                  <Trash2 className="h-3 w-3" />
                </Button>
              )}
            </div>
            {/* Notes for this allowance */}
            {canEdit && isEditing && (
              <div className="pl-5">
                <input
                  type="text"
                  className="w-full h-6 text-xs bg-background border border-border rounded px-2 text-muted-foreground"
                  placeholder="Notes..."
                  defaultValue={aa.notes || ''}
                  onBlur={(e) => {
                    if (e.target.value !== (aa.notes || '')) {
                      handleUpdateNotes(aa.id, e.target.value);
                    }
                  }}
                />
              </div>
            )}
            {aa.notes && !isEditing && (
              <div className="pl-5 text-xs text-muted-foreground italic">{aa.notes}</div>
            )}
          </div>
        );
      })}

      {/* Add extras button */}
      {canEdit && availableExtras.length > 0 && (
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

      {/* Total */}
      {(extrasTotal > 0 || travel > 0) && (
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

function AssignmentCard({ assignment, eventId, isAdmin, isOperations, currentUserId }: { assignment: EventAssignment; eventId: string; isAdmin: boolean; isOperations?: boolean; currentUserId?: string }) {
  const sendNotification = useSendNotification();
  const queryClient = useQueryClient();
  const [editingRole, setEditingRole] = useState(false);
  const { data: staffRoles = [] } = useStaffRoles();
  const removeAssignment = useMutation({
    mutationFn: async () => {
      const { error } = await supabase
        .from('event_assignments')
        .delete()
        .eq('id', assignment.id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['event-assignments', eventId] });
      toast.success(`${name} removed from event`);
    },
    onError: (error: Error) => {
      toast.error('Failed to remove', { description: error.message });
    },
  });

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
      toast.error('Failed to update role', { description: error.message });
    } else {
      queryClient.invalidateQueries({ queryKey: ['event-assignments', eventId] });
      toast.success('Role updated');
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
          <div className="flex items-center gap-2 flex-wrap">
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
      </div>
      {isAdmin && (
        <div className="grid grid-cols-2 gap-1.5 mt-3 pt-3 border-t border-border/50">
          <Link to={`/events/${eventId}/day-of`} className="contents">
            <Button
              variant="ghost"
              size="sm"
              className="h-7 text-xs gap-1.5 w-full"
              title="Preview crew job sheet"
            >
              <Eye className="h-3.5 w-3.5" />
              Preview
            </Button>
          </Link>
          {confirmationStatus !== 'confirmed' && (
            <Button
              variant="outline"
              size="sm"
              className="h-7 text-xs w-full"
              onClick={async () => {
                const { data: updated, error } = await supabase
                  .from('event_assignments')
                  .update({ confirmation_status: 'confirmed', confirmed_at: new Date().toISOString() })
                  .eq('id', assignment.id)
                  .select();
                if (error) {
                  toast.error('Failed to confirm', { description: error.message });
                } else if (!updated || updated.length === 0) {
                  toast.error('Failed to confirm', { description: 'No rows updated. Check permissions.' });
                } else {
                  queryClient.invalidateQueries({ queryKey: ['event-assignments', eventId] });
                  toast.success('Marked as confirmed');
                }
              }}
              title="Mark as confirmed"
            >
              <CheckCircle className="h-3.5 w-3.5 mr-1" />
              Confirm
            </Button>
          )}
          <Button
            variant="outline"
            size="sm"
            className="h-7 text-xs w-full"
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
            <Send className="h-3.5 w-3.5 mr-1" />
            Resend
          </Button>
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button
                variant="outline"
                size="sm"
                className="h-7 text-xs w-full text-destructive hover:text-destructive hover:bg-destructive/10"
                title="Remove from event"
                disabled={removeAssignment.isPending}
              >
                {removeAssignment.isPending ? <Loader2 className="h-3.5 w-3.5 mr-1 animate-spin" /> : <Trash2 className="h-3.5 w-3.5 mr-1" />}
                {removeAssignment.isPending ? 'Removing...' : 'Remove'}
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Remove {name} from this event?</AlertDialogTitle>
                <AlertDialogDescription>
                  This will unassign them from the event. Any equipment allocations or workflow progress tied to this assignment will also be removed. This action cannot be undone.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancel</AlertDialogCancel>
                <AlertDialogAction
                  className="bg-destructive hover:bg-destructive/90"
                  onClick={() => removeAssignment.mutate()}
                  disabled={removeAssignment.isPending}
                >
                  {removeAssignment.isPending ? 'Removing...' : 'Remove'}
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>
      )}
      <AssignmentBudgetLine assignment={assignment} eventId={eventId} isAdmin={isAdmin} isOperations={isOperations} isSelf={!!currentUserId && assignment.user_id === currentUserId} />
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
  // Status update state
  const [isUpdatingStatus, setIsUpdatingStatus] = useState(false);
  const [activeTab, setActiveTab] = useState('overview');
  const [recommendCrewOpen, setRecommendCrewOpen] = useState(false);
  const [sendEmailOpen, setSendEmailOpen] = useState(false);
  const [isSendingTeamUpdate, setIsSendingTeamUpdate] = useState(false);
  const [teamUpdateDialogOpen, setTeamUpdateDialogOpen] = useState(false);
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
  const getDeliveryMethodName = (
    field: 'delivery_method_id' | 'delivery_method_guests_id' | 'delivery_method_photographer_id' = 'delivery_method_id'
  ) => {
    if (!event) return '';
    const fieldId = (event as any)[field];
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
                {(event.client_id || (clientByName as any)?.id) && (
                  <CompanyStatusBadgeDropdown
                    companyId={event.client_id || (clientByName as any)?.id}
                    currentStatus={((event as any).clients?.status) || ((clientByName as any)?.status) || 'prospect'}
                    manualStatus={((event as any).clients?.manual_status) ?? ((clientByName as any)?.manual_status) ?? null}
                  />
                )}
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
                    {deleteEvent.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
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
                      disabled={deleteEvent.isPending}
                    >
                      {deleteEvent.isPending ? 'Deleting...' : 'Delete'}
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            )}
          </div>
        )}
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
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
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-lg font-display font-semibold">{event?.event_name || 'Event Details'}</h2>
                  {isAdmin && (
                    <Button size="sm" variant="outline" asChild>
                      <Link to={`/events/${id}/edit`}>
                        <Edit className="h-3.5 w-3.5 mr-1" />
                        Edit
                      </Link>
                    </Button>
                  )}
                </div>
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

                  {/* Delivery - Photographer */}
                  <div className="flex items-start gap-3">
                    <div className="p-2 bg-primary/10 rounded-lg">
                      <Package className="h-4 w-4 text-primary" />
                    </div>
                    <div className="flex-1">
                      <p className="text-sm text-muted-foreground">Delivery - Photographer</p>
                      {isAdmin ? (
                        <Select
                          value={(event as any).delivery_method_photographer_id || ''}
                          onValueChange={async (value) => {
                            setIsUpdatingStatus(true);
                            await updateEvent.mutateAsync({
                              id: event.id,
                              delivery_method_photographer_id: value,
                            } as any);
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
                        <p className="font-medium capitalize">{getDeliveryMethodName('delivery_method_photographer_id') || 'Not set'}</p>
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

                  {(event as any).event_website && (
                    <div className="flex items-start gap-3">
                      <div className="p-2 bg-primary/10 rounded-lg">
                        <Globe className="h-4 w-4 text-primary" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm text-muted-foreground">Event Website</p>
                        <a
                          href={(event as any).event_website}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="font-medium text-primary hover:underline break-all"
                        >
                          {(event as any).event_website}
                        </a>
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
                  <SessionsDisplay eventId={id} assignments={assignments} />
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
               {/* Assigned Team (summary) */}
               {canSeeSection('contacts') && assignments.length > 0 && (
                 <div className="bg-card border border-border rounded-xl p-5 shadow-card">
                   <div className="flex items-center justify-between mb-4">
                     <h2 className="text-lg font-display font-semibold flex items-center gap-2">
                       <Users className="h-4 w-4" />
                       Assigned Team ({assignments.length})
                     </h2>
                     <Button variant="outline" size="sm" onClick={() => setActiveTab('assignments')}>
                       Manage
                     </Button>
                   </div>
                   <div className="space-y-2">
                     {assignments.map((a: any) => {
                       const name = a.profile?.full_name || a.staff?.name || 'Unknown';
                       const role = a.staff_role?.name || a.role_on_event || a.staff?.role || 'Staff';
                       const status = a.confirmation_status || 'pending';
                       const initials = name.split(' ').map((n: string) => n[0]).join('').substring(0, 2).toUpperCase();
                       return (
                         <div key={a.id} className="flex items-center gap-3 p-2 rounded-lg bg-muted/30">
                           <div className="w-9 h-9 rounded-full bg-primary/20 flex items-center justify-center shrink-0">
                             <span className="text-sm font-medium text-primary">{initials}</span>
                           </div>
                           <div className="flex-1 min-w-0">
                             <div className="flex items-center gap-2 flex-wrap">
                               <Link to={`/staff/${a.user_id || a.staff_id}`} className="text-sm font-medium truncate hover:underline text-primary">
                                 {name}
                               </Link>
                               <Badge
                                 variant={status === 'confirmed' ? 'default' : status === 'declined' ? 'destructive' : 'secondary'}
                                 className="text-xs shrink-0"
                               >
                                 {status === 'confirmed' ? 'Confirmed' : status === 'declined' ? 'Declined' : 'Pending'}
                               </Badge>
                             </div>
                             <p className="text-xs text-muted-foreground capitalize truncate">{role}</p>
                           </div>
                         </div>
                       );
                     })}
                   </div>
                 </div>
               )}
               {/* Dress Code (admin-managed lookup) */}
              {canSeeSection('contacts') && id && (
                <EventDressCodeCard
                  eventId={id}
                  value={(event as any).dress_code}
                  canEdit={isAdmin || isOperations}
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
                      <p className="text-sm whitespace-pre-wrap">{event.coverage_details}</p>
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

              {/* Proposed Services (Scope) — flows into budgets & contracts */}
              {id && canSeeSection('additional_details') && (
                <ProposedServicesEditor
                  target="event"
                  targetId={id}
                  value={(event as any).proposed_services}
                  invalidateKeys={[['event', id]]}
                  disableAi={!(isAdmin || isOperations)}
                />
              )}

              
              {/* Team Brief (internal) */}
              {id && canSeeSection('team_brief') && (
                <EventBriefPanel
                  eventId={id}
                  briefTemplateId={(event as any).brief_template_id}
                  briefContent={(event as any).brief_content}
                  briefFileName={(event as any).brief_file_name}
                  briefFilePath={(event as any).brief_file_path}
                  isAdmin={isAdmin}
                />
              )}

              {/* Event Brief (shared with client) */}
              {id && canSeeSection('client_brief') && (
                <ClientBriefPanel
                  eventId={id}
                  clientBriefContent={(event as any).client_brief_content}
                  clientBriefTemplateId={(event as any).client_brief_template_id}
                  clientBriefFileName={(event as any).client_brief_file_name}
                  clientBriefFilePath={(event as any).client_brief_file_path}
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
                          // When event marked completed, return client to Active Client
                          if (value === 'completed' && event.client_id) {
                            await setClientStatusAuto(event.client_id, 'active', 'event_completed');
                          }
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
                            <SelectItem value="invoiced_deposit">Invoiced - Deposit</SelectItem>
                            <SelectItem value="deposit_paid">Deposit Paid</SelectItem>
                            <SelectItem value="invoiced_full">Invoiced - Full</SelectItem>
                            <SelectItem value="paid_in_full">Paid in Full</SelectItem>
                            <SelectItem value="sponsored">Sponsored</SelectItem>
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

              {/* QR Registration */}
              {id && canSeeSection('qr_panel') && (
                <EventQrPanel
                  eventId={id}
                  qrFilePath={(event as any).qr_file_path || null}
                  qrFileName={(event as any).qr_file_name || null}
                  preRegistrationLink={(event as any).pre_registration_link || null}
                  liveFeedLink={(event as any).live_feed_link || null}
                  dropboxLink={(event as any).dropbox_link || null}
                  smugmugLink={(event as any).smugmug_link || null}
                  artworkDriveLink={(event as any).artwork_drive_link || null}
                  eventWebPageLink={(event as any).event_web_page_link || null}
                  isAdmin={isAdmin || isOperations || isSales}
                />
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
                  eventSeriesId={(event as any).event_series_id}
                  clientId={(event as any).client_id}
                />
              )}

              {/* Payment (Team) Panel */}
              {id && (
                <EventPaymentPanel
                  eventId={id}
                  isAdmin={isAdmin}
                  isOperations={isOperations}
                  currentUserId={user?.id}
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
                          toast.error('Portal token not found', { description: 'Try refreshing the page.' });
                        }
                      }}
                    >
                      <Eye className="h-4 w-4 mr-2" />
                      View as Client
                    </Button>
                  )}
                  {(isAdmin || isOperations) && (
                    <Link to={`/events/${id}/day-of`} className="block">
                      <Button variant="outline" className="w-full justify-start">
                        <Eye className="h-4 w-4 mr-2" />
                        View as Photographer
                      </Button>
                    </Link>
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
                        <Badge variant="outline" className={cn('text-[10px] px-1.5 py-0', getActionStatusDisplay(emailStatuses.send_email.status, emailStatuses.send_email.sentAt).className)}>
                          {getActionStatusDisplay(emailStatuses.send_email.status, emailStatuses.send_email.sentAt).label}
                        </Badge>
                      )}
                    </Button>
                  )}
                  {(isAdmin || isOperations) && (
                    <Button variant="outline" className="w-full justify-between" onClick={() => setFinalConfirmOpen(true)}>
                      <span className="flex items-center">
                        <CheckCircle className="h-4 w-4 mr-2" />
                        Send Final Confirmation (Client & Team)
                      </span>
                      {emailStatuses && (
                        <Badge variant="outline" className={cn('text-[10px] px-1.5 py-0', getActionStatusDisplay(emailStatuses.final_confirmation.status, emailStatuses.final_confirmation.sentAt).className)}>
                          {getActionStatusDisplay(emailStatuses.final_confirmation.status, emailStatuses.final_confirmation.sentAt).label}
                        </Badge>
                      )}
                    </Button>
                  )}
                  {(isAdmin || isOperations) && ((event as any).pre_registration_link || (event as any).qr_file_path) && (
                    <Button variant="outline" className="w-full justify-start" onClick={() => setLiveAccessOpen(true)}>
                      <QrCode className="h-4 w-4 mr-2" />
                      <span className="flex-1 text-left">Send Live Access (Client & Team)</span>
                      {emailStatuses && (
                        <Badge variant="outline" className={cn('text-[10px] px-1.5 py-0', getActionStatusDisplay(emailStatuses.live_access.status, emailStatuses.live_access.sentAt).className)}>
                          {getActionStatusDisplay(emailStatuses.live_access.status, emailStatuses.live_access.sentAt).label}
                        </Badge>
                      )}
                    </Button>
                  )}
                  {(isAdmin || isOperations) && ((event as any).dropbox_link || (event as any).smugmug_link) && (
                    <Button
                      variant="outline"
                      className="w-full justify-between"
                      onClick={() => setDropboxEmailOpen(true)}
                    >
                      <span className="flex items-center">
                        <Package className="h-4 w-4 mr-2" />
                        Send Dropbox/SmugMug Link (Client)
                      </span>
                      {emailStatuses && (
                        <Badge variant="outline" className={cn('text-[10px] px-1.5 py-0', getActionStatusDisplay(emailStatuses.dropbox_delivery.status, emailStatuses.dropbox_delivery.sentAt).className)}>
                          {getActionStatusDisplay(emailStatuses.dropbox_delivery.status, emailStatuses.dropbox_delivery.sentAt).label}
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
                        eventPortalToken={event.client_portal_token}
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
                        <Badge variant="outline" className={cn('text-[10px] px-1.5 py-0 shrink-0', getActionStatusDisplay(emailStatuses.portal_link.status, emailStatuses.portal_link.sentAt).className)}>
                          {getActionStatusDisplay(emailStatuses.portal_link.status, emailStatuses.portal_link.sentAt).label}
                        </Badge>
                      )}
                    </div>
                  )}
                  {(isAdmin || isOperations) && assignments.length > 0 && (
                    <Button 
                      variant="outline" 
                      className="w-full justify-between" 
                      onClick={() => setTeamUpdateDialogOpen(true)}
                    >
                      <span className="flex items-center">
                        <Users className="h-4 w-4 mr-2" />
                        Send Updated Details to Team
                      </span>
                      {emailStatuses && (
                        <Badge variant="outline" className={cn('text-[10px] px-1.5 py-0', getActionStatusDisplay(emailStatuses.team_update.status, emailStatuses.team_update.sentAt).className)}>
                          {getActionStatusDisplay(emailStatuses.team_update.status, emailStatuses.team_update.sentAt).label}
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
                        Request Files from Photographer
                      </span>
                      {emailStatuses?.request_files && (
                        <Badge variant="outline" className={cn('text-[10px] px-1.5 py-0', getActionStatusDisplay(emailStatuses.request_files.status, emailStatuses.request_files.sentAt).className)}>
                          {getActionStatusDisplay(emailStatuses.request_files.status, emailStatuses.request_files.sentAt).label}
                        </Badge>
                      )}
                    </Button>
                  )}
                  {(isAdmin || isOperations) && (
                    <div className="mt-2 pt-3 border-t space-y-2">
                      <p className="text-xs font-medium text-muted-foreground">Client portal sharing</p>
                      <label className="flex items-start gap-2 text-xs cursor-pointer">
                        <Checkbox
                          checked={!!(event as any).share_team_vehicle_info}
                          onCheckedChange={async (checked) => {
                            await supabase.from('events').update({ share_team_vehicle_info: !!checked }).eq('id', id!);
                            queryClient.invalidateQueries({ queryKey: ['events', id] });
                          }}
                          className="mt-0.5"
                        />
                        <span>Share team vehicle rego & make/model</span>
                      </label>
                      <label className="flex items-start gap-2 text-xs cursor-pointer">
                        <Checkbox
                          checked={!!(event as any).share_team_dietary}
                          onCheckedChange={async (checked) => {
                            await supabase.from('events').update({ share_team_dietary: !!checked }).eq('id', id!);
                            queryClient.invalidateQueries({ queryKey: ['events', id] });
                          }}
                          className="mt-0.5"
                        />
                        <span>Share team dietary requirements</span>
                      </label>
                    </div>
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
                {/* If there are no sessions, just show all assignments flat */}
                {eventSessions.length === 0 && (
                  <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
                    {assignments.map(assignment => (
                      <AssignmentCard key={assignment.id} assignment={assignment} eventId={id!} isAdmin={isAdmin} isOperations={isOperations} currentUserId={user?.id} />
                    ))}
                  </div>
                )}

                {/* Group sessions by date so multiple sessions on the same day display together */}
                {(() => {
                  const generalAssigns = assignments.filter(a => !a.session_id);
                  const byDate = new Map<string, typeof eventSessions>();
                  eventSessions.forEach(s => {
                    const key = s.session_date;
                    if (!byDate.has(key)) byDate.set(key, [] as any);
                    (byDate.get(key) as any).push(s);
                  });
                  const sortedDates = Array.from(byDate.keys()).sort();
                  return sortedDates.map(date => {
                    const daySessions = byDate.get(date)!;
                    const sessionIds = daySessions.map(s => s.id);
                    const dayAssigns = [
                      ...generalAssigns,
                      ...assignments.filter(a => a.session_id && sessionIds.includes(a.session_id)),
                    ];
                    // Build a short range/label summary for the day's sessions
                    const sessionSummaries = daySessions.map(s => {
                      const parts: string[] = [];
                      if (s.start_time) {
                        parts.push(
                          `${formatSessionTime(s.start_time)}${s.end_time ? ` – ${formatSessionTime(s.end_time)}` : ''}`
                        );
                      }
                      if (s.label) parts.push(s.label);
                      return parts.join(' ');
                    }).filter(Boolean);
                    return (
                      <div key={date} className="border border-border rounded-lg p-4">
                        <div className="flex items-center gap-2 mb-3 flex-wrap">
                          <Calendar className="h-4 w-4 text-primary" />
                          <h3 className="text-sm font-medium">
                            {format(parseISO(date), 'EEE, d MMM yyyy')}
                          </h3>
                          {sessionSummaries.map((s, i) => (
                            <Badge key={i} variant="outline" className="text-xs font-normal">{s}</Badge>
                          ))}
                        </div>
                        {dayAssigns.length === 0 ? (
                          <p className="text-xs text-muted-foreground italic pl-6">No crew assigned to this day</p>
                        ) : (
                          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
                            {dayAssigns.map(assignment => (
                              <AssignmentCard key={assignment.id} assignment={assignment} eventId={id!} isAdmin={isAdmin} isOperations={isOperations} currentUserId={user?.id} />
                            ))}
                          </div>
                        )}
                      </div>
                    );
                  });
                })()}
              </div>
            )}
          </div>

          {/* Crew Checklists - admin/ops only */}
          {(isAdmin || isOperations) && id && assignments.length > 0 && (
            <CrewChecklistsPanel eventId={id} assignments={assignments} />
          )}
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
            client_portal_token: event.client_portal_token,
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
            client_portal_token: event.client_portal_token,
            primary_contact_name: primaryContactName,
            primary_contact_phone: primaryContactEmail,
            delivery_method: getDeliveryMethodName('delivery_method_id'),
            delivery_method_guests: getDeliveryMethodName('delivery_method_guests_id'),
            arrival_time: eventSessions[0]?.arrival_time || null,
            client_brief_content: (event as any).client_brief_content,
            share_team_vehicle_info: !!(event as any).share_team_vehicle_info,
            share_team_dietary: !!(event as any).share_team_dietary,
          }}
          recipients={emailRecipients}
          assignments={assignments}
          sessions={eventSessions}
          onsiteContacts={eventContacts
            .filter((c: any) => c.contact_type === 'onsite')
            .map((c: any) => ({
              name: c.contact_name || c.client_contact?.contact_name || '',
              phone: c.contact_phone || c.client_contact?.phone_mobile || c.client_contact?.phone || null,
              email: c.contact_email || c.client_contact?.email || null,
            }))
            .filter((c: any) => c.name)}
        />
      )}

      {id && event && (
        <SendTeamUpdateDialog
          open={teamUpdateDialogOpen}
          onOpenChange={setTeamUpdateDialogOpen}
          eventId={id}
          eventName={event.event_name}
          assignments={assignments}
        />
      )}
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
            client_portal_token: event.client_portal_token,
          }}
          recipients={emailRecipients}
          initialSubject={`Live Access Details – ${event.event_name} – ${event.event_date ? format(parseISO(event.event_date), 'EEEE d MMMM yyyy') : ''}`}
          initialBody={(() => {
            const regLink = (event as any).pre_registration_link || '';
            const liveFeedLink = (event as any).live_feed_link || '';
            return `<p>Hi {{client_name}},</p>` +
              `<p>Here are your links to access photos via RealTime delivery for ${event.event_name}.</p>` +
              ((event as any).qr_file_path
                ? `<p>The QR code (attached) can be printed and displayed at the event so your guests can scan it to register and access their photos instantly.</p>`
                : `<p>The QR code (provided separately) can be printed and displayed at the event so your guests can scan it to register and access their photos instantly.</p>`) +
              (regLink ? `<p><strong>Registration Link:</strong><br/><a href="${regLink}">${regLink}</a></p>` : '') +
              (liveFeedLink ? `<p><strong>Live Feed Link</strong> (for your social media manager or team to access all photos during the event):<br/><a href="${liveFeedLink}">${liveFeedLink}</a></p>` : '') +
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

      {/* Send Dropbox/SmugMug Link Dialog */}
      {id && event && ((event as any).dropbox_link || (event as any).smugmug_link) && (
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
            client_portal_token: event.client_portal_token,
          }}
          recipients={emailRecipients}
          initialSubject={`Your photos are ready – ${event.event_name}`}
          initialBody={(() => {
            const dropboxLink = (event as any).dropbox_link;
            const smugmugLink = (event as any).smugmug_link;
            const hasDropbox = !!dropboxLink;
            const hasSmugMug = !!smugmugLink;

            let body = `<p>Hi {{client_name}},</p>` +
              `<p>Thank you for having EventPix cover your event – <strong>${event.event_name}</strong> – the files have now been edited and uploaded`;

            if (hasDropbox && hasSmugMug) {
              body += ` to <a href="${dropboxLink}"><strong>Dropbox</strong></a>.</p>`;
              body += `<p>We have also created a <a href="${smugmugLink}"><strong>gallery</strong></a> for your guests to access.</p>`;
            } else if (hasDropbox) {
              body += ` to <a href="${dropboxLink}"><strong>Dropbox</strong></a>.</p>`;
            } else {
              body += `.</p><p>Your <a href="${smugmugLink}"><strong>gallery</strong></a> is now ready for you and your guests to access.</p>`;
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
            client_portal_token: event.client_portal_token,
          }}
          recipients={emailRecipients.filter(r => r.type === 'photographer' || r.type === 'assistant')}
          
          initialSubject={`Request to upload files – ${event.event_name}`}
          initialBody={(() => {
            const eventDate = event.event_date ? format(parseISO(event.event_date), 'EEEE d MMMM yyyy') : '';
            return `Hi,\n` +
              `Thank you for shooting ${event.event_name}${eventDate ? ` on ${eventDate}` : ''}.\n` +
              `Please upload the event files to our portal at your earliest convenience:\n` +
              `[Upload Files Here](https://trevorsteam-portal-6373224367.portal.massive.io/)\n` +
              `If you have any questions, please don't hesitate to get in touch.\n` +
              `Kind regards,\nThe EventPix Team`;
          })()}
        />
      )}
    </AppLayout>
  );
}
