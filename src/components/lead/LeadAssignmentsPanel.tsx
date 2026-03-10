/**
 * LEAD ASSIGNMENTS PANEL
 * 
 * Shows staff assigned to a lead with pending confirmation status.
 * Allows adding/removing staff from a lead before conversion to event.
 */
import { useState } from 'react';
import { Users, Plus, Trash2, Clock, UserPlus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import {
  useLeadAssignments,
  useCreateLeadAssignment,
  useDeleteLeadAssignment,
  LeadAssignment,
} from '@/hooks/useLeadAssignments';
import { useStaffDirectoryWithLocation, useStaffRoles } from '@/hooks/useStaff';

interface LeadAssignmentsPanelProps {
  leadId: string;
}

function AssignmentRow({
  assignment,
  leadId,
}: {
  assignment: LeadAssignment;
  leadId: string;
}) {
  const deleteAssignment = useDeleteLeadAssignment();
  const name = assignment.profile?.full_name || 'Unknown';
  const initials = name
    .split(' ')
    .map((n) => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);

  return (
    <div className="flex items-center gap-3 py-2 px-3 rounded-lg hover:bg-muted/50 transition-colors">
      <Avatar className="h-8 w-8">
        <AvatarFallback className="text-xs bg-muted">{initials}</AvatarFallback>
      </Avatar>

      <div className="flex-1 min-w-0">
        <div className="text-sm font-medium truncate">{name}</div>
        {assignment.staff_role?.name && (
          <div className="text-xs text-muted-foreground">
            {assignment.staff_role.name}
          </div>
        )}
      </div>

      <Badge
        variant="outline"
        className="text-xs bg-amber-500/10 text-amber-600 border-amber-500/30"
      >
        <Clock className="h-3 w-3 mr-1" />
        Pending
      </Badge>

      <Button
        variant="ghost"
        size="icon"
        className="h-7 w-7 text-muted-foreground hover:text-destructive"
        onClick={() => deleteAssignment.mutate({ id: assignment.id, leadId })}
        disabled={deleteAssignment.isPending}
      >
        <Trash2 className="h-3.5 w-3.5" />
      </Button>
    </div>
  );
}

export function LeadAssignmentsPanel({ leadId }: LeadAssignmentsPanelProps) {
  const { data: assignments = [], isLoading } = useLeadAssignments(leadId);
  const createAssignment = useCreateLeadAssignment();
  const { data: profiles = [] } = useStaffDirectoryWithLocation();
  const { data: roles = [] } = useStaffRoles();

  const [dialogOpen, setDialogOpen] = useState(false);
  const [selectedUser, setSelectedUser] = useState('');
  const [selectedRole, setSelectedRole] = useState('');
  const [notes, setNotes] = useState('');

  // Filter out already-assigned staff
  const assignedUserIds = new Set(assignments.map((a) => a.user_id));
  const availableProfiles = profiles.filter(
    (p) => !assignedUserIds.has(p.id)
  );

  const handleAssign = async () => {
    if (!selectedUser) return;
    await createAssignment.mutateAsync({
      lead_id: leadId,
      user_id: selectedUser,
      staff_role_id: selectedRole || undefined,
      assignment_notes: notes || undefined,
    });
    setDialogOpen(false);
    setSelectedUser('');
    setSelectedRole('');
    setNotes('');
  };

  return (
    <>
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Users className="h-5 w-5 text-muted-foreground" />
              <CardTitle className="text-lg">Team</CardTitle>
              {assignments.length > 0 && (
                <Badge variant="secondary" className="text-xs">
                  {assignments.length}
                </Badge>
              )}
            </div>
            <Button
              size="icon"
              className="h-7 w-7 rounded-full bg-primary"
              onClick={() => setDialogOpen(true)}
            >
              <Plus className="h-4 w-4" />
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="text-sm text-muted-foreground text-center py-4">
              Loading...
            </div>
          ) : assignments.length === 0 ? (
            <div className="text-center py-6">
              <UserPlus className="h-8 w-8 mx-auto text-muted-foreground/50 mb-2" />
              <p className="text-sm text-muted-foreground">No team assigned yet</p>
              <Button
                variant="outline"
                size="sm"
                className="mt-3"
                onClick={() => setDialogOpen(true)}
              >
                <Plus className="h-4 w-4 mr-1.5" />
                Assign Staff
              </Button>
            </div>
          ) : (
            <div className="space-y-1">
              {assignments.map((assignment) => (
                <AssignmentRow
                  key={assignment.id}
                  assignment={assignment}
                  leadId={leadId}
                />
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Add Staff Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Assign Staff to Lead</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label>Team Member</Label>
              <Select value={selectedUser} onValueChange={setSelectedUser}>
                <SelectTrigger>
                  <SelectValue placeholder="Select team member..." />
                </SelectTrigger>
                <SelectContent>
                  {availableProfiles.map((profile) => (
                    <SelectItem key={profile.id} value={profile.id}>
                      {profile.full_name || profile.id}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Role</Label>
              <Select value={selectedRole} onValueChange={setSelectedRole}>
                <SelectTrigger>
                  <SelectValue placeholder="Select role..." />
                </SelectTrigger>
                <SelectContent>
                  {roles.map((role) => (
                    <SelectItem key={role.id} value={role.id}>
                      {role.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Notes (optional)</Label>
              <Textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Assignment notes..."
                rows={2}
              />
            </div>

            <Button
              className="w-full"
              onClick={handleAssign}
              disabled={!selectedUser || createAssignment.isPending}
            >
              <UserPlus className="h-4 w-4 mr-2" />
              Assign to Lead
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
