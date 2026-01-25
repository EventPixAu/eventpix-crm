import { useState, useMemo, useEffect } from 'react';
import { UserPlus, X, Users, AlertTriangle, CalendarX, Clock, AlertCircle, ShieldAlert, ShieldCheck } from 'lucide-react';
import { format } from 'date-fns';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useStaffDirectory, useStaffRoles } from '@/hooks/useStaff';
import { useCreateAssignment, useDeleteAssignment, useEvent, type EventAssignment } from '@/hooks/useEvents';
import { useSendNotification } from '@/hooks/useNotifications';
import { useCheckConflicts } from '@/hooks/useCalendar';
import { useCheckAssignmentConflicts, useStaffAvailabilityByDate, AssignmentWarning } from '@/hooks/useStaffAvailability';
import { useLogAuditEntry } from '@/hooks/useAuditLog';
import { EligibilityBadge } from '@/components/AssignmentEligibilityWarning';
import { useCheckAssignmentGuardrails, type GuardrailCheck } from '@/hooks/useGuardrails';
import { GuardrailOverrideDialog } from '@/components/GuardrailOverrideDialog';
import { useAuth } from '@/lib/auth';

interface StaffAssignmentDialogProps {
  eventId: string;
  assignments: EventAssignment[];
  maxStaff?: number;
}

const MAX_STAFF_DEFAULT = 8;

export function StaffAssignmentDialog({ eventId, assignments, maxStaff = MAX_STAFF_DEFAULT }: StaffAssignmentDialogProps) {
  const [open, setOpen] = useState(false);
  const [selectedUser, setSelectedUser] = useState('');
  const [selectedRole, setSelectedRole] = useState('');
  const [assignmentNotes, setAssignmentNotes] = useState('');
  const [warnings, setWarnings] = useState<AssignmentWarning[]>([]);
  
  // Guardrail state
  const [guardrailChecks, setGuardrailChecks] = useState<{ hardBlocks: GuardrailCheck[]; softBlocks: GuardrailCheck[] } | null>(null);
  const [showGuardrailDialog, setShowGuardrailDialog] = useState(false);
  const [guardrailOverridden, setGuardrailOverridden] = useState(false);
  
  const { user } = useAuth();
  const { data: profiles = [] } = useStaffDirectory();
  const { data: roles = [] } = useStaffRoles();
  const { data: event } = useEvent(eventId);
  const createAssignment = useCreateAssignment();
  const deleteAssignment = useDeleteAssignment();
  const sendNotification = useSendNotification();
  const checkConflicts = useCheckAssignmentConflicts();
  const checkGuardrails = useCheckAssignmentGuardrails();
  const logAuditEntry = useLogAuditEntry();
  
  // Fetch availability for the event date
  const { data: dateAvailability = [] } = useStaffAvailabilityByDate(event?.event_date);

  // Check conflicts for selected user
  const eventStart = useMemo(() => {
    if (!event?.start_at) return null;
    return new Date(event.start_at);
  }, [event?.start_at]);
  
  const eventEnd = useMemo(() => {
    if (!event?.end_at) return null;
    return new Date(event.end_at);
  }, [event?.end_at]);

  const { data: conflicts = [] } = useCheckConflicts(
    selectedUser || undefined,
    eventStart,
    eventEnd,
    eventId
  );
  
  // Check for availability and routing conflicts when user is selected
  useEffect(() => {
    if (selectedUser && event) {
      // Check legacy conflicts
      checkConflicts.mutate({
        userId: selectedUser,
        eventId,
        eventDate: event.event_date,
        startAt: event.start_at,
        endAt: event.end_at,
      }, {
        onSuccess: (result) => setWarnings(result),
      });
      
      // Check guardrails
      checkGuardrails.mutate({
        userId: selectedUser,
        eventId,
        eventDate: event.event_date,
        startAt: event.start_at || null,
        endAt: event.end_at || null,
      }, {
        onSuccess: (result) => setGuardrailChecks(result),
      });
    } else {
      setWarnings([]);
      setGuardrailChecks(null);
    }
    setGuardrailOverridden(false);
  }, [selectedUser, event?.event_date, event?.start_at, event?.end_at]);
  
  // Get user availability status
  const selectedUserAvailability = useMemo(() => {
    if (!selectedUser) return null;
    return dateAvailability.find(a => a.user_id === selectedUser);
  }, [selectedUser, dateAvailability]);
  
  const assignedUserIds = assignments.map((a) => a.user_id).filter(Boolean);
  const availableProfiles = profiles.filter(
    (profile) => !assignedUserIds.includes(profile.id)
  );
  
  // Check if we've hit the max staff limit
  const isAtMaxCapacity = assignments.length >= maxStaff;
  const remainingSlots = maxStaff - assignments.length;

  // Check guardrail status
  const hasHardBlocks = guardrailChecks?.hardBlocks && guardrailChecks.hardBlocks.length > 0;
  const hasSoftBlocks = guardrailChecks?.softBlocks && guardrailChecks.softBlocks.length > 0;
  const hasGuardrailIssues = hasHardBlocks || hasSoftBlocks;
  const requiresGuardrailOverride = hasGuardrailIssues && !guardrailOverridden;

  const handleAssignClick = () => {
    if (!selectedUser) return;
    
    // If there are guardrail issues and not yet overridden, show the dialog
    if (requiresGuardrailOverride) {
      setShowGuardrailDialog(true);
      return;
    }
    
    // Otherwise proceed with assignment
    executeAssignment();
  };
  
  const handleGuardrailOverrideConfirmed = () => {
    setGuardrailOverridden(true);
    setShowGuardrailDialog(false);
    // Proceed with assignment after override
    executeAssignment();
  };
  
  const executeAssignment = async () => {
    if (!selectedUser) return;

    const result = await createAssignment.mutateAsync({
      event_id: eventId,
      user_id: selectedUser,
      staff_role_id: selectedRole || undefined,
      assignment_notes: assignmentNotes || undefined,
    });

    // Send notification after successful assignment
    if (result) {
      sendNotification.mutate({
        type: 'assignment',
        event_id: eventId,
        user_id: selectedUser,
        assignment_id: result.id,
      });
    }

    setSelectedUser('');
    setSelectedRole('');
    setAssignmentNotes('');
    setGuardrailChecks(null);
    setGuardrailOverridden(false);
  };

  const handleRemove = async (assignmentId: string) => {
    await deleteAssignment.mutateAsync({ id: assignmentId, eventId });
  };

  // Helper to get display name from assignment
  const getAssignmentName = (assignment: EventAssignment): string => {
    if (assignment.profile?.full_name) return assignment.profile.full_name;
    if (assignment.staff?.name) return assignment.staff.name;
    return assignment.profile?.email || 'Unknown';
  };

  // Helper to get role display from assignment
  const getAssignmentRole = (assignment: EventAssignment): string => {
    if (assignment.staff_role?.name) return assignment.staff_role.name;
    if (assignment.role_on_event) return assignment.role_on_event;
    if (assignment.staff?.role) return assignment.staff.role;
    return 'Staff';
  };

  // Helper to get initials
  const getInitials = (assignment: EventAssignment): string => {
    const name = getAssignmentName(assignment);
    return name.charAt(0).toUpperCase();
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm">
          <Users className="h-4 w-4 mr-2" />
          Manage
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Manage Staff Assignments</DialogTitle>
          <DialogDescription>
            Assign photographers and other staff to this event. ({assignments.length}/{maxStaff} slots used)
          </DialogDescription>
        </DialogHeader>

        {/* Current Assignments */}
        <div className="space-y-3">
          <Label>Assigned Staff</Label>
          {assignments.length === 0 ? (
            <p className="text-sm text-muted-foreground py-2">No staff assigned yet</p>
          ) : (
            <div className="space-y-2 max-h-40 overflow-y-auto">
              {assignments.map((assignment) => (
                <div
                  key={assignment.id}
                  className="flex items-center justify-between p-2 bg-muted/50 rounded-lg"
                >
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-full bg-primary/20 flex items-center justify-center">
                      <span className="text-xs font-medium text-primary">
                        {getInitials(assignment)}
                      </span>
                    </div>
                    <div>
                      <p className="text-sm font-medium">{getAssignmentName(assignment)}</p>
                      <p className="text-xs text-muted-foreground capitalize">
                        {getAssignmentRole(assignment)}
                      </p>
                    </div>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleRemove(assignment.id)}
                    disabled={deleteAssignment.isPending}
                  >
                    <X className="h-4 w-4 text-muted-foreground hover:text-destructive" />
                  </Button>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Add New Assignment */}
        {isAtMaxCapacity ? (
          <Alert className="mt-4">
            <Users className="h-4 w-4" />
            <AlertTitle>Maximum Staff Reached</AlertTitle>
            <AlertDescription>
              This event has reached the maximum of {maxStaff} staff assignments. Remove an existing assignment to add another.
            </AlertDescription>
          </Alert>
        ) : (
        <div className="space-y-3 pt-4 border-t">
          <Label>Add Staff Member ({remainingSlots} slot{remainingSlots !== 1 ? 's' : ''} remaining)</Label>
          <Select value={selectedUser} onValueChange={setSelectedUser}>
            <SelectTrigger>
              <SelectValue placeholder="Select staff member" />
            </SelectTrigger>
            <SelectContent>
              {availableProfiles.length === 0 ? (
                <SelectItem value="none" disabled>
                  No available staff
                </SelectItem>
              ) : (
                availableProfiles.map((profile) => (
                  <SelectItem key={profile.id} value={profile.id}>
                    <div className="flex items-center gap-2">
                      <span>{profile.full_name || 'Unnamed Staff'}</span>
                      <EligibilityBadge userId={profile.id} />
                    </div>
                  </SelectItem>
                ))
              )}
            </SelectContent>
          </Select>

          <Select value={selectedRole} onValueChange={setSelectedRole}>
            <SelectTrigger>
              <SelectValue placeholder="Select role on event" />
            </SelectTrigger>
            <SelectContent>
              {roles.map((role) => (
                <SelectItem key={role.id} value={role.id}>
                  {role.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Textarea
            placeholder="Assignment notes (optional)"
            value={assignmentNotes}
            onChange={(e) => setAssignmentNotes(e.target.value)}
            rows={2}
          />

          {/* Guardrail Hard Blocks */}
          {hasHardBlocks && (
            <Alert variant="destructive">
              <ShieldAlert className="h-4 w-4" />
              <AlertTitle>Assignment Blocked</AlertTitle>
              <AlertDescription>
                <ul className="list-disc list-inside space-y-1 mt-1">
                  {guardrailChecks?.hardBlocks.map((block, i) => (
                    <li key={i}>
                      <span className="font-medium">{block.message}</span>
                      {block.details && <span className="text-xs block ml-4 opacity-80">{block.details}</span>}
                    </li>
                  ))}
                </ul>
              </AlertDescription>
            </Alert>
          )}

          {/* Guardrail Soft Blocks */}
          {hasSoftBlocks && !hasHardBlocks && (
            <Alert className="border-amber-500/50 bg-amber-500/10">
              <AlertCircle className="h-4 w-4 text-amber-600" />
              <AlertTitle className="text-amber-600">Warnings</AlertTitle>
              <AlertDescription>
                <ul className="list-disc list-inside space-y-1 mt-1">
                  {guardrailChecks?.softBlocks.map((block, i) => (
                    <li key={i}>
                      <span className="font-medium">{block.message}</span>
                      {block.details && <span className="text-xs block ml-4 opacity-80">{block.details}</span>}
                    </li>
                  ))}
                </ul>
              </AlertDescription>
            </Alert>
          )}
          
          {/* Override confirmed indicator */}
          {guardrailOverridden && hasGuardrailIssues && (
            <Alert className="border-green-500/50 bg-green-500/10">
              <ShieldCheck className="h-4 w-4 text-green-600" />
              <AlertTitle className="text-green-600">Override Approved</AlertTitle>
              <AlertDescription>
                Guardrail issues have been acknowledged. You can proceed with the assignment.
              </AlertDescription>
            </Alert>
          )}

          {/* Availability Status Indicator */}
          {selectedUserAvailability && !hasGuardrailIssues && (
            <Alert 
              variant={selectedUserAvailability.availability_status === 'unavailable' ? 'destructive' : 'default'}
              className={selectedUserAvailability.availability_status === 'limited' ? 'border-amber-500/50 bg-amber-500/10' : ''}
            >
              {selectedUserAvailability.availability_status === 'unavailable' ? (
                <CalendarX className="h-4 w-4" />
              ) : (
                <AlertCircle className="h-4 w-4 text-amber-600" />
              )}
              <AlertTitle className={selectedUserAvailability.availability_status === 'limited' ? 'text-amber-600' : ''}>
                {selectedUserAvailability.availability_status === 'unavailable' ? 'Unavailable' : 'Limited Availability'}
              </AlertTitle>
              <AlertDescription>
                {selectedUserAvailability.notes || 
                  (selectedUserAvailability.availability_status === 'unavailable' 
                    ? 'This staff member has marked themselves unavailable on this date.'
                    : 'This staff member has limited availability on this date.'
                  )
                }
              </AlertDescription>
            </Alert>
          )}

          {/* Legacy Conflict Warning from calendar check (shown only if no guardrail issues) */}
          {conflicts.length > 0 && !hasGuardrailIssues && (
            <Alert variant="destructive" className="bg-orange-50 border-orange-200 text-orange-800">
              <AlertTriangle className="h-4 w-4" />
              <AlertDescription>
                <strong>Conflict:</strong> This staff member is already assigned to{' '}
                {conflicts.map((c, i) => (
                  <span key={c.event_id}>
                    {i > 0 && ', '}
                    <strong>{c.event_name}</strong> at {format(new Date(c.start_at), 'h:mm a')}
                  </span>
                ))}
              </AlertDescription>
            </Alert>
          )}

          <Button
            onClick={handleAssignClick}
            disabled={!selectedUser || createAssignment.isPending}
            className="w-full"
            variant={hasGuardrailIssues && !guardrailOverridden ? "destructive" : "default"}
          >
            <UserPlus className="h-4 w-4 mr-2" />
            {hasGuardrailIssues && !guardrailOverridden 
              ? (hasHardBlocks ? 'Override Required' : 'Review Warnings & Assign')
              : 'Assign to Event'
            }
          </Button>
        </div>
        )}
        
        {/* Guardrail Override Dialog */}
        <GuardrailOverrideDialog
          open={showGuardrailDialog}
          onOpenChange={setShowGuardrailDialog}
          hardBlocks={guardrailChecks?.hardBlocks || []}
          softBlocks={guardrailChecks?.softBlocks || []}
          eventId={eventId}
          userId={user?.id || ''}
          onOverrideConfirmed={handleGuardrailOverrideConfirmed}
          overrideType="assignment"
        />
      </DialogContent>
    </Dialog>
  );
}
