/**
 * LEAD ASSIGNMENTS PANEL
 * 
 * Shows staff assigned to a lead, grouped by session for multi-day events.
 * Allows adding/removing staff per session or as general assignments.
 */
import { useState, useEffect } from 'react';
import { Users, Plus, Trash2, Clock, UserPlus, Calendar } from 'lucide-react';
import { format, parseISO } from 'date-fns';
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
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

interface LeadAssignmentsPanelProps {
  leadId: string;
}

interface SessionInfo {
  id: string;
  session_date: string;
  label: string | null;
  start_time: string | null;
  end_time: string | null;
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

function formatSessionDate(dateStr: string) {
  try {
    return format(parseISO(dateStr), 'EEE, d MMM');
  } catch {
    return dateStr;
  }
}

function formatTime(timeStr: string | null) {
  if (!timeStr) return '';
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

export function LeadAssignmentsPanel({ leadId }: LeadAssignmentsPanelProps) {
  const { data: assignments = [], isLoading } = useLeadAssignments(leadId);
  const createAssignment = useCreateLeadAssignment();
  const { data: profiles = [] } = useStaffDirectoryWithLocation();
  const { data: roles = [] } = useStaffRoles();

  // Fetch sessions for this lead
  const { data: sessions = [] } = useQuery({
    queryKey: ['lead-sessions-for-assignments', leadId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('event_sessions')
        .select('id, session_date, label, start_time, end_time')
        .eq('lead_id', leadId)
        .order('session_date')
        .order('sort_order');
      if (error) throw error;
      return (data || []) as SessionInfo[];
    },
    enabled: !!leadId,
  });

  const [dialogOpen, setDialogOpen] = useState(false);
  const [selectedUser, setSelectedUser] = useState('');
  const [selectedRole, setSelectedRole] = useState('');
  const [selectedSession, setSelectedSession] = useState('all');
  const [notes, setNotes] = useState('');

  // Auto-select session when there's only one
  useEffect(() => {
    if (sessions.length === 1 && selectedSession === 'all') {
      setSelectedSession(sessions[0].id);
    }
  }, [sessions, selectedSession]);

  const hasSessions = sessions.length > 0;

  // Group assignments by session
  const generalAssignments = assignments.filter((a) => !a.session_id);
  const sessionAssignments = new Map<string, LeadAssignment[]>();
  sessions.forEach((s) => sessionAssignments.set(s.id, []));
  assignments.forEach((a) => {
    if (a.session_id && sessionAssignments.has(a.session_id)) {
      sessionAssignments.get(a.session_id)!.push(a);
    }
  });

  // Filter out already-assigned staff for the selected session context
  const assignedUserIds = new Set(
    assignments
      .filter((a) => selectedSession === 'all' ? !a.session_id : a.session_id === selectedSession)
      .map((a) => a.user_id)
  );
  const availableProfiles = profiles.filter(
    (p) => !assignedUserIds.has(p.id)
  );

  const handleAssign = async () => {
    if (!selectedUser) return;
    await createAssignment.mutateAsync({
      lead_id: leadId,
      user_id: selectedUser,
      staff_role_id: selectedRole || undefined,
      session_id: selectedSession !== 'all' ? selectedSession : undefined,
      assignment_notes: notes || undefined,
    });
    setDialogOpen(false);
    setSelectedUser('');
    setSelectedRole('');
    setNotes('');
  };

  const openDialogForSession = (sessionId?: string) => {
    setSelectedSession(sessionId || 'all');
    setDialogOpen(true);
  };

  const totalAssignments = assignments.length;

  return (
    <>
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Users className="h-5 w-5 text-muted-foreground" />
              <CardTitle className="text-lg">Team</CardTitle>
              {totalAssignments > 0 && (
                <Badge variant="secondary" className="text-xs">
                  {totalAssignments}
                </Badge>
              )}
            </div>
            <Button
              size="icon"
              className="h-7 w-7 rounded-full bg-primary"
              onClick={() => openDialogForSession()}
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
          ) : totalAssignments === 0 && !hasSessions ? (
            <div className="text-center py-6">
              <UserPlus className="h-8 w-8 mx-auto text-muted-foreground/50 mb-2" />
              <p className="text-sm text-muted-foreground">No team assigned yet</p>
              <Button
                variant="outline"
                size="sm"
                className="mt-3"
                onClick={() => openDialogForSession()}
              >
                <Plus className="h-4 w-4 mr-1.5" />
                Assign Staff
              </Button>
            </div>
          ) : (
            <div className="space-y-3">
              {/* General (all-session) assignments */}
              {generalAssignments.length > 0 && hasSessions && (
                <div>
                  <div className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-1.5">
                    All Sessions
                  </div>
                  <div className="space-y-1">
                    {generalAssignments.map((a) => (
                      <AssignmentRow key={a.id} assignment={a} leadId={leadId} />
                    ))}
                  </div>
                </div>
              )}

              {/* If no sessions, show flat list */}
              {!hasSessions && generalAssignments.length > 0 && (
                <div className="space-y-1">
                  {generalAssignments.map((a) => (
                    <AssignmentRow key={a.id} assignment={a} leadId={leadId} />
                  ))}
                </div>
              )}

              {/* Per-session assignments */}
              {hasSessions && sessions.map((session) => {
                const sessionAssigns = sessionAssignments.get(session.id) || [];
                return (
                  <div key={session.id} className="border border-border rounded-lg p-3">
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2">
                        <Calendar className="h-3.5 w-3.5 text-primary" />
                        <span className="text-sm font-medium">
                          {formatSessionDate(session.session_date)}
                        </span>
                        {session.start_time && (
                          <span className="text-xs text-muted-foreground">
                            {formatTime(session.start_time)}
                            {session.end_time ? ` – ${formatTime(session.end_time)}` : ''}
                          </span>
                        )}
                      </div>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-6 w-6"
                        onClick={() => openDialogForSession(session.id)}
                      >
                        <Plus className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                    {sessionAssigns.length === 0 ? (
                      <p className="text-xs text-muted-foreground italic pl-5">
                        No crew assigned
                      </p>
                    ) : (
                      <div className="space-y-1">
                        {sessionAssigns.map((a) => (
                          <AssignmentRow key={a.id} assignment={a} leadId={leadId} />
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}

              {/* Empty sessions prompt */}
              {hasSessions && totalAssignments === 0 && (
                <p className="text-xs text-muted-foreground text-center pt-1">
                  Assign staff to individual sessions above
                </p>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Add Staff Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Assign Staff</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            {hasSessions && (
              <div className="space-y-2">
                <Label>Session</Label>
                <Select value={selectedSession} onValueChange={setSelectedSession}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select session..." />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Sessions</SelectItem>
                    {sessions.map((s) => (
                      <SelectItem key={s.id} value={s.id}>
                        {formatSessionDate(s.session_date)}
                        {s.start_time ? ` • ${formatTime(s.start_time)}` : ''}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

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
              Assign
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
