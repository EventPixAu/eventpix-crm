import { useState } from 'react';
import { UserPlus, X, Users } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useStaff } from '@/hooks/useStaff';
import { useCreateAssignment, useDeleteAssignment, type EventAssignment } from '@/hooks/useEvents';

interface StaffAssignmentDialogProps {
  eventId: string;
  assignments: EventAssignment[];
}

export function StaffAssignmentDialog({ eventId, assignments }: StaffAssignmentDialogProps) {
  const [open, setOpen] = useState(false);
  const [selectedStaff, setSelectedStaff] = useState('');
  const [roleOnEvent, setRoleOnEvent] = useState('');
  const { data: allStaff = [] } = useStaff();
  const createAssignment = useCreateAssignment();
  const deleteAssignment = useDeleteAssignment();

  const assignedStaffIds = assignments.map((a) => a.staff_id);
  const availableStaff = allStaff.filter(
    (staff) => !assignedStaffIds.includes(staff.id) && staff.status === 'active'
  );

  const handleAssign = async () => {
    if (!selectedStaff) return;

    await createAssignment.mutateAsync({
      event_id: eventId,
      staff_id: selectedStaff,
      role_on_event: roleOnEvent || null,
    });

    setSelectedStaff('');
    setRoleOnEvent('');
  };

  const handleRemove = async (assignmentId: string) => {
    await deleteAssignment.mutateAsync({ id: assignmentId, eventId });
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
                        {assignment.staff?.name?.[0] || '?'}
                      </span>
                    </div>
                    <div>
                      <p className="text-sm font-medium">{assignment.staff?.name}</p>
                      <p className="text-xs text-muted-foreground capitalize">
                        {assignment.role_on_event || assignment.staff?.role}
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
          <Select value={selectedStaff} onValueChange={setSelectedStaff}>
            <SelectTrigger>
              <SelectValue placeholder="Select staff member" />
            </SelectTrigger>
            <SelectContent>
              {availableStaff.length === 0 ? (
                <SelectItem value="none" disabled>
                  No available staff
                </SelectItem>
              ) : (
                availableStaff.map((staff) => (
                  <SelectItem key={staff.id} value={staff.id}>
                    {staff.name} ({staff.role})
                  </SelectItem>
                ))
              )}
            </SelectContent>
          </Select>

          <Input
            placeholder="Role on event (optional)"
            value={roleOnEvent}
            onChange={(e) => setRoleOnEvent(e.target.value)}
          />

          <Button
            onClick={handleAssign}
            disabled={!selectedStaff || createAssignment.isPending}
            className="w-full"
          >
            <UserPlus className="h-4 w-4 mr-2" />
            Assign to Event
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
