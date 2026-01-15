import { useState, useMemo } from 'react';
import { UserPlus, X, Users, AlertTriangle } from 'lucide-react';
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
import { Alert, AlertDescription } from '@/components/ui/alert';
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

interface StaffAssignmentDialogProps {
  eventId: string;
  assignments: EventAssignment[];
}

export function StaffAssignmentDialog({ eventId, assignments }: StaffAssignmentDialogProps) {
  const [open, setOpen] = useState(false);
  const [selectedUser, setSelectedUser] = useState('');
  const [selectedRole, setSelectedRole] = useState('');
  const [assignmentNotes, setAssignmentNotes] = useState('');
  
  const { data: profiles = [] } = useStaffProfiles();
  const { data: roles = [] } = useStaffRoles();
  const { data: event } = useEvent(eventId);
  const createAssignment = useCreateAssignment();
  const deleteAssignment = useDeleteAssignment();
  const sendNotification = useSendNotification();

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

  // Get assigned user IDs (supporting both new user_id and legacy staff_id)
  const assignedUserIds = assignments.map((a) => a.user_id).filter(Boolean);
  const availableProfiles = profiles.filter(
    (profile) => !assignedUserIds.includes(profile.id)
  );

  const handleAssign = async () => {
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

          {/* Conflict Warning */}
          {conflicts.length > 0 && (
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
            onClick={handleAssign}
            disabled={!selectedUser || createAssignment.isPending}
            className="w-full"
            variant={conflicts.length > 0 ? "destructive" : "default"}
          >
            <UserPlus className="h-4 w-4 mr-2" />
            {conflicts.length > 0 ? 'Assign Anyway' : 'Assign to Event'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
