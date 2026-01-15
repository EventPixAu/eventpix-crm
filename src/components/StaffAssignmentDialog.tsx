import { useState, useMemo, useEffect } from 'react';
import { UserPlus, X, Users, AlertTriangle, CalendarX, Clock, AlertCircle } from 'lucide-react';
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
import { Checkbox } from '@/components/ui/checkbox';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useStaffProfiles, useStaffRoles } from '@/hooks/useStaff';
import { useCreateAssignment, useDeleteAssignment, useEvent, type EventAssignment } from '@/hooks/useEvents';
import { useSendNotification } from '@/hooks/useNotifications';
import { useCheckConflicts } from '@/hooks/useCalendar';
import { useCheckAssignmentConflicts, useStaffAvailabilityByDate, AssignmentWarning } from '@/hooks/useStaffAvailability';
import { useLogAuditEntry } from '@/hooks/useAuditLog';

interface StaffAssignmentDialogProps {
  eventId: string;
  assignments: EventAssignment[];
}

export function StaffAssignmentDialog({ eventId, assignments }: StaffAssignmentDialogProps) {
  const [open, setOpen] = useState(false);
  const [selectedUser, setSelectedUser] = useState('');
  const [selectedRole, setSelectedRole] = useState('');
  const [assignmentNotes, setAssignmentNotes] = useState('');
  const [overrideConfirmed, setOverrideConfirmed] = useState(false);
  const [warnings, setWarnings] = useState<AssignmentWarning[]>([]);
  
  const { data: profiles = [] } = useStaffProfiles();
  const { data: roles = [] } = useStaffRoles();
  const { data: event } = useEvent(eventId);
  const createAssignment = useCreateAssignment();
  const deleteAssignment = useDeleteAssignment();
  const sendNotification = useSendNotification();
  const checkConflicts = useCheckAssignmentConflicts();
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
      checkConflicts.mutate({
        userId: selectedUser,
        eventId,
        eventDate: event.event_date,
        startAt: event.start_at,
        endAt: event.end_at,
      }, {
        onSuccess: (result) => setWarnings(result),
      });
    } else {
      setWarnings([]);
    }
    setOverrideConfirmed(false);
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

  // Check if we have errors that require override
  const hasErrors = warnings.some(w => w.severity === 'error');
  const hasWarnings = warnings.length > 0;
  const requiresOverride = hasErrors || (hasWarnings && !overrideConfirmed);

  const handleAssign = async () => {
    if (!selectedUser) return;
    
    // Log override if there were warnings
    if (hasWarnings && overrideConfirmed) {
      logAuditEntry.mutate({
        action: 'assignment_override',
        eventId,
        after: {
          user_id: selectedUser,
          warnings: warnings.map(w => ({ type: w.type, message: w.message })),
          notes: assignmentNotes,
        },
      });
    }

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
            Assign photographers and other staff to this event.
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
        <div className="space-y-3 pt-4 border-t">
          <Label>Add Staff Member</Label>
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
                    {profile.full_name || profile.email}
                    {profile.default_role?.name && ` (${profile.default_role.name})`}
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

          {/* Availability Status Indicator */}
          {selectedUserAvailability && (
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

          {/* Routing & Conflict Warnings */}
          {warnings.length > 0 && (
            <div className="space-y-2">
              {warnings.filter(w => w.severity === 'error').length > 0 && (
                <Alert variant="destructive">
                  <AlertTriangle className="h-4 w-4" />
                  <AlertTitle>Assignment Conflicts</AlertTitle>
                  <AlertDescription>
                    <ul className="list-disc list-inside space-y-1 mt-1">
                      {warnings.filter(w => w.severity === 'error').map((w, i) => (
                        <li key={i}>{w.message}</li>
                      ))}
                    </ul>
                  </AlertDescription>
                </Alert>
              )}
              
              {warnings.filter(w => w.severity === 'warning').length > 0 && (
                <Alert className="border-amber-500/50 bg-amber-500/10">
                  <Clock className="h-4 w-4 text-amber-600" />
                  <AlertTitle className="text-amber-600">Warnings</AlertTitle>
                  <AlertDescription>
                    <ul className="list-disc list-inside space-y-1 mt-1">
                      {warnings.filter(w => w.severity === 'warning').map((w, i) => (
                        <li key={i}>{w.message}</li>
                      ))}
                    </ul>
                  </AlertDescription>
                </Alert>
              )}
            </div>
          )}

          {/* Legacy Conflict Warning from calendar check */}
          {conflicts.length > 0 && warnings.length === 0 && (
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
          
          {/* Override Confirmation */}
          {hasWarnings && (
            <div className="flex items-center space-x-2 p-3 bg-muted/50 rounded-lg">
              <Checkbox 
                id="override" 
                checked={overrideConfirmed}
                onCheckedChange={(checked) => setOverrideConfirmed(!!checked)}
              />
              <label htmlFor="override" className="text-sm cursor-pointer">
                I acknowledge these warnings and want to proceed with the assignment
              </label>
            </div>
          )}

          <Button
            onClick={handleAssign}
            disabled={!selectedUser || createAssignment.isPending || (hasWarnings && !overrideConfirmed)}
            className="w-full"
            variant={hasWarnings ? "destructive" : "default"}
          >
            <UserPlus className="h-4 w-4 mr-2" />
            {hasWarnings ? 'Override & Assign' : 'Assign to Event'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
