import { useState, useMemo } from 'react';
import { UserPlus, AlertTriangle, CheckCircle2, XCircle, Loader2, ShieldAlert, ShieldCheck, AlertCircle } from 'lucide-react';
import { format } from 'date-fns';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useStaffDirectory, useStaffRoles } from '@/hooks/useStaff';
import { useCreateAssignment } from '@/hooks/useEvents';
import { useSendNotification } from '@/hooks/useNotifications';
import { supabase } from '@/integrations/supabase/client';
import type { CalendarEvent } from '@/hooks/useCalendar';
import { useToast } from '@/hooks/use-toast';
import { useQueryClient } from '@tanstack/react-query';
import { useCheckAssignmentGuardrails, type GuardrailCheck } from '@/hooks/useGuardrails';
import { GuardrailOverrideDialog } from '@/components/GuardrailOverrideDialog';
import { useAuth } from '@/lib/auth';

interface BulkAssignmentDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  selectedEvents: CalendarEvent[];
  onComplete: () => void;
}

interface ConflictInfo {
  eventId: string;
  eventName: string;
  startAt: string;
}

interface AssignmentResult {
  eventId: string;
  eventName: string;
  success: boolean;
  error?: string;
}

interface UserGuardrailStatus {
  userId: string;
  hardBlocks: GuardrailCheck[];
  softBlocks: GuardrailCheck[];
}

export function BulkAssignmentDialog({
  open,
  onOpenChange,
  selectedEvents,
  onComplete,
}: BulkAssignmentDialogProps) {
  const [selectedUsers, setSelectedUsers] = useState<string[]>([]);
  const [selectedRole, setSelectedRole] = useState('');
  const [assignmentNotes, setAssignmentNotes] = useState('');
  const [isAssigning, setIsAssigning] = useState(false);
  const [results, setResults] = useState<AssignmentResult[]>([]);
  const [conflicts, setConflicts] = useState<Map<string, ConflictInfo[]>>(new Map());
  const [acknowledgeConflicts, setAcknowledgeConflicts] = useState(false);
  
  // Guardrail state
  const [userGuardrails, setUserGuardrails] = useState<Map<string, UserGuardrailStatus>>(new Map());
  const [showGuardrailDialog, setShowGuardrailDialog] = useState(false);
  const [guardrailsOverridden, setGuardrailsOverridden] = useState(false);

  const { user } = useAuth();
  const { data: profiles = [] } = useStaffDirectory();
  const { data: roles = [] } = useStaffRoles();
  const sendNotification = useSendNotification();
  const checkGuardrails = useCheckAssignmentGuardrails();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Check conflicts when users are selected
  const checkConflicts = async (userIds: string[]) => {
    if (userIds.length === 0 || selectedEvents.length === 0) {
      setConflicts(new Map());
      return;
    }

    const conflictMap = new Map<string, ConflictInfo[]>();

    for (const userId of userIds) {
      const userConflicts: ConflictInfo[] = [];

      for (const event of selectedEvents) {
        if (!event.start_at) continue;

        const { data } = await supabase.rpc('check_staff_conflicts', {
          p_user_id: userId,
          p_start_at: event.start_at,
          p_end_at: event.end_at || null,
          p_exclude_event_id: event.id,
        });

        if (data && data.length > 0) {
          data.forEach((c: any) => {
            userConflicts.push({
              eventId: c.event_id,
              eventName: c.event_name,
              startAt: c.start_at,
            });
          });
        }
      }

      if (userConflicts.length > 0) {
        conflictMap.set(userId, userConflicts);
      }
    }

    setConflicts(conflictMap);
  };

  // Check guardrails for selected users
  const checkUserGuardrails = async (userIds: string[]) => {
    if (userIds.length === 0 || selectedEvents.length === 0) {
      setUserGuardrails(new Map());
      return;
    }

    const guardrailMap = new Map<string, UserGuardrailStatus>();

    for (const userId of userIds) {
      // Check guardrails against the first event (as a representative sample)
      const firstEvent = selectedEvents[0];
      
      try {
        const result = await checkGuardrails.mutateAsync({
          userId,
          eventId: firstEvent.id,
          eventDate: firstEvent.event_date,
          startAt: firstEvent.start_at || null,
          endAt: firstEvent.end_at || null,
        });

        if (result.hardBlocks.length > 0 || result.softBlocks.length > 0) {
          guardrailMap.set(userId, {
            userId,
            hardBlocks: result.hardBlocks,
            softBlocks: result.softBlocks,
          });
        }
      } catch (err) {
        console.error('Guardrail check failed for user:', userId, err);
      }
    }

    setUserGuardrails(guardrailMap);
  };

  const handleUserToggle = async (userId: string, checked: boolean) => {
    const newUsers = checked
      ? [...selectedUsers, userId]
      : selectedUsers.filter((id) => id !== userId);
    setSelectedUsers(newUsers);
    setGuardrailsOverridden(false);
    await Promise.all([
      checkConflicts(newUsers),
      checkUserGuardrails(newUsers),
    ]);
  };

  const handleAssignClick = () => {
    if (selectedUsers.length === 0 || selectedEvents.length === 0) return;
    
    // Check if guardrails need override
    if (hasGuardrailIssues && !guardrailsOverridden) {
      setShowGuardrailDialog(true);
      return;
    }
    
    executeAssignments();
  };

  const handleGuardrailOverrideConfirmed = () => {
    setGuardrailsOverridden(true);
    setShowGuardrailDialog(false);
    executeAssignments();
  };

  const executeAssignments = async () => {
    if (selectedUsers.length === 0 || selectedEvents.length === 0) return;

    setIsAssigning(true);
    setResults([]);
    const newResults: AssignmentResult[] = [];

    try {
      for (const event of selectedEvents) {
        for (const userId of selectedUsers) {
          try {
            // Check if already assigned
            const { data: existing } = await supabase
              .from('event_assignments')
              .select('id')
              .eq('event_id', event.id)
              .eq('user_id', userId)
              .maybeSingle();

            if (existing) {
              newResults.push({
                eventId: event.id,
                eventName: event.event_name,
                success: false,
                error: 'Already assigned',
              });
              continue;
            }

            // Create assignment
            const { data, error } = await supabase
              .from('event_assignments')
              .insert({
                event_id: event.id,
                user_id: userId,
                staff_role_id: selectedRole || null,
                assignment_notes: assignmentNotes || null,
              })
              .select()
              .single();

            if (error) throw error;

            // Send notification
            if (data) {
              sendNotification.mutate({
                type: 'assignment',
                event_id: event.id,
                user_id: userId,
                assignment_id: data.id,
              });
            }

            newResults.push({
              eventId: event.id,
              eventName: event.event_name,
              success: true,
            });
          } catch (err: any) {
            newResults.push({
              eventId: event.id,
              eventName: event.event_name,
              success: false,
              error: err.message || 'Unknown error',
            });
          }
        }
      }

      setResults(newResults);

      // Invalidate queries
      queryClient.invalidateQueries({ queryKey: ['event-assignments'] });
      queryClient.invalidateQueries({ queryKey: ['admin-calendar-events'] });

      const successCount = newResults.filter((r) => r.success).length;
      const failCount = newResults.filter((r) => !r.success).length;

      if (failCount === 0) {
        toast({
          title: 'Bulk assignment complete',
          description: `Successfully assigned ${selectedUsers.length} staff to ${selectedEvents.length} events`,
        });
        handleClose();
        onComplete();
      } else {
        toast({
          variant: successCount > 0 ? 'default' : 'destructive',
          title: 'Bulk assignment completed with issues',
          description: `${successCount} successful, ${failCount} failed`,
        });
      }
    } catch (err: any) {
      toast({
        variant: 'destructive',
        title: 'Bulk assignment failed',
        description: err.message,
      });
    } finally {
      setIsAssigning(false);
    }
  };

  const handleClose = () => {
    setSelectedUsers([]);
    setSelectedRole('');
    setAssignmentNotes('');
    setResults([]);
    setConflicts(new Map());
    setAcknowledgeConflicts(false);
    setUserGuardrails(new Map());
    setGuardrailsOverridden(false);
    onOpenChange(false);
  };

  const hasConflicts = conflicts.size > 0;
  const hasGuardrailIssues = userGuardrails.size > 0;
  const totalHardBlocks = Array.from(userGuardrails.values()).reduce((sum, g) => sum + g.hardBlocks.length, 0);
  const totalSoftBlocks = Array.from(userGuardrails.values()).reduce((sum, g) => sum + g.softBlocks.length, 0);
  
  // Aggregate all guardrail issues for the override dialog
  const aggregatedHardBlocks = useMemo(() => {
    const blocks: GuardrailCheck[] = [];
    userGuardrails.forEach((status, userId) => {
      status.hardBlocks.forEach(block => {
        blocks.push({
          ...block,
          message: `${getProfileName(userId)}: ${block.message}`,
        });
      });
    });
    return blocks;
  }, [userGuardrails, profiles]);

  const aggregatedSoftBlocks = useMemo(() => {
    const blocks: GuardrailCheck[] = [];
    userGuardrails.forEach((status, userId) => {
      status.softBlocks.forEach(block => {
        blocks.push({
          ...block,
          message: `${getProfileName(userId)}: ${block.message}`,
        });
      });
    });
    return blocks;
  }, [userGuardrails, profiles]);

  const canAssign =
    selectedUsers.length > 0 &&
    (!hasConflicts || acknowledgeConflicts) &&
    (!hasGuardrailIssues || guardrailsOverridden) &&
    !isAssigning;

  const getProfileName = (id: string) => {
    const profile = profiles.find((p) => p.id === id);
    return profile?.full_name || 'Unknown';
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-lg max-h-[90vh] flex flex-col">
        <DialogHeader>
          <DialogTitle>Bulk Staff Assignment</DialogTitle>
          <DialogDescription>
            Assign staff to {selectedEvents.length} selected event
            {selectedEvents.length !== 1 && 's'}
          </DialogDescription>
        </DialogHeader>

        {/* Selected Events Summary */}
        <div className="space-y-2">
          <Label>Selected Events</Label>
          <ScrollArea className="h-24 rounded-md border p-2">
            <div className="space-y-1">
              {selectedEvents.map((event) => (
                <div key={event.id} className="flex items-center gap-2 text-sm">
                  <span className="font-medium">{event.event_name}</span>
                  {event.start_time && (
                    <Badge variant="outline" className="text-xs">
                      {format(new Date(`2000-01-01T${event.start_time}`), 'h:mm a')}
                    </Badge>
                  )}
                </div>
              ))}
            </div>
          </ScrollArea>
        </div>

        {/* Staff Selection */}
        <div className="space-y-2">
          <Label>Select Staff Members</Label>
          <ScrollArea className="h-40 rounded-md border p-2">
            <div className="space-y-2">
              {profiles.map((profile) => {
                const hasConflict = conflicts.has(profile.id);
                const isSelected = selectedUsers.includes(profile.id);

                return (
                  <div
                    key={profile.id}
                    className={`flex items-center gap-3 p-2 rounded-lg transition-colors ${
                      isSelected
                        ? hasConflict
                          ? 'bg-orange-50 dark:bg-orange-900/20'
                          : 'bg-primary/10'
                        : 'hover:bg-muted/50'
                    }`}
                  >
                    <Checkbox
                      id={profile.id}
                      checked={isSelected}
                      onCheckedChange={(checked) =>
                        handleUserToggle(profile.id, !!checked)
                      }
                    />
                    <div className="flex-1 min-w-0">
                      <label
                        htmlFor={profile.id}
                        className="text-sm font-medium cursor-pointer"
                      >
                        {profile.full_name || 'Unnamed Staff'}
                      </label>
                    </div>
                    {hasConflict && (
                      <Badge
                        variant="outline"
                        className="text-orange-600 border-orange-300 shrink-0"
                      >
                        <AlertTriangle className="h-3 w-3 mr-1" />
                        {conflicts.get(profile.id)?.length} conflict
                        {(conflicts.get(profile.id)?.length || 0) > 1 && 's'}
                      </Badge>
                    )}
                    {userGuardrails.has(profile.id) && (
                      <Badge
                        variant="outline"
                        className={
                          userGuardrails.get(profile.id)!.hardBlocks.length > 0
                            ? 'text-red-600 border-red-300 shrink-0'
                            : 'text-amber-600 border-amber-300 shrink-0'
                        }
                      >
                        <ShieldAlert className="h-3 w-3 mr-1" />
                        {userGuardrails.get(profile.id)!.hardBlocks.length > 0 ? 'Blocked' : 'Warning'}
                      </Badge>
                    )}
                  </div>
                );
              })}
            </div>
          </ScrollArea>
        </div>

        {/* Role Selection */}
        <div className="space-y-2">
          <Label>Role on Events</Label>
          <Select value={selectedRole} onValueChange={setSelectedRole}>
            <SelectTrigger>
              <SelectValue placeholder="Select role (optional)" />
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

        {/* Assignment Notes */}
        <div className="space-y-2">
          <Label>Assignment Notes</Label>
          <Textarea
            placeholder="Notes for all assignments (optional)"
            value={assignmentNotes}
            onChange={(e) => setAssignmentNotes(e.target.value)}
            rows={2}
          />
        </div>

        {/* Guardrail Warnings */}
        {hasGuardrailIssues && !guardrailsOverridden && (
          <Alert variant={totalHardBlocks > 0 ? 'destructive' : 'default'} className={totalHardBlocks === 0 ? 'border-amber-500/50 bg-amber-500/10' : ''}>
            {totalHardBlocks > 0 ? (
              <ShieldAlert className="h-4 w-4" />
            ) : (
              <AlertCircle className="h-4 w-4 text-amber-600" />
            )}
            <AlertTitle className={totalHardBlocks === 0 ? 'text-amber-600' : ''}>
              {totalHardBlocks > 0 ? 'Assignment Guardrails Triggered' : 'Guardrail Warnings'}
            </AlertTitle>
            <AlertDescription>
              <div className="space-y-1 mt-1">
                {totalHardBlocks > 0 && (
                  <p>{totalHardBlocks} hard block{totalHardBlocks > 1 && 's'} detected across {userGuardrails.size} staff member{userGuardrails.size > 1 && 's'}</p>
                )}
                {totalSoftBlocks > 0 && (
                  <p>{totalSoftBlocks} warning{totalSoftBlocks > 1 && 's'} detected across {userGuardrails.size} staff member{userGuardrails.size > 1 && 's'}</p>
                )}
                <p className="text-xs mt-2">Click "Override & Assign" to review and acknowledge these issues.</p>
              </div>
            </AlertDescription>
          </Alert>
        )}

        {/* Guardrail Override Confirmed */}
        {guardrailsOverridden && hasGuardrailIssues && (
          <Alert className="border-green-500/50 bg-green-500/10">
            <ShieldCheck className="h-4 w-4 text-green-600" />
            <AlertTitle className="text-green-600">Guardrails Overridden</AlertTitle>
            <AlertDescription>
              All guardrail issues have been acknowledged. You can proceed with the assignment.
            </AlertDescription>
          </Alert>
        )}

        {/* Conflict Warning */}
        {hasConflicts && (
          <Alert
            variant="destructive"
            className="bg-orange-50 border-orange-200 text-orange-800 dark:bg-orange-900/20 dark:border-orange-800 dark:text-orange-200"
          >
            <AlertTriangle className="h-4 w-4" />
            <AlertDescription>
              <div className="space-y-2">
                <p className="font-medium">
                  Scheduling conflicts detected for {conflicts.size} staff member
                  {conflicts.size > 1 && 's'}:
                </p>
                <div className="text-sm space-y-1">
                  {Array.from(conflicts.entries()).map(([userId, userConflicts]) => (
                    <div key={userId}>
                      <strong>{getProfileName(userId)}</strong>: {userConflicts.length}{' '}
                      conflict{userConflicts.length > 1 && 's'}
                    </div>
                  ))}
                </div>
                <div className="flex items-center gap-2 pt-2">
                  <Checkbox
                    id="acknowledge-conflicts"
                    checked={acknowledgeConflicts}
                    onCheckedChange={(checked) =>
                      setAcknowledgeConflicts(!!checked)
                    }
                  />
                  <label
                    htmlFor="acknowledge-conflicts"
                    className="text-sm cursor-pointer"
                  >
                    I understand and want to assign anyway
                  </label>
                </div>
              </div>
            </AlertDescription>
          </Alert>
        )}

        {/* Results */}
        {results.length > 0 && (
          <div className="space-y-2">
            <Label>Results</Label>
            <ScrollArea className="h-24 rounded-md border p-2">
              <div className="space-y-1">
                {results.map((result, idx) => (
                  <div
                    key={idx}
                    className={`flex items-center gap-2 text-sm ${
                      result.success ? 'text-green-600' : 'text-red-600'
                    }`}
                  >
                    {result.success ? (
                      <CheckCircle2 className="h-4 w-4 shrink-0" />
                    ) : (
                      <XCircle className="h-4 w-4 shrink-0" />
                    )}
                    <span className="truncate">{result.eventName}</span>
                    {result.error && (
                      <span className="text-xs text-muted-foreground">
                        ({result.error})
                      </span>
                    )}
                  </div>
                ))}
              </div>
            </ScrollArea>
          </div>
        )}

        {/* Actions */}
        <div className="flex justify-end gap-2 pt-4 border-t">
          <Button variant="outline" onClick={handleClose} disabled={isAssigning}>
            Cancel
          </Button>
          <Button
            onClick={handleAssignClick}
            disabled={!canAssign && !(hasGuardrailIssues && !guardrailsOverridden)}
            variant={hasConflicts || (hasGuardrailIssues && !guardrailsOverridden) ? 'destructive' : 'default'}
          >
            {isAssigning ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Assigning...
              </>
            ) : hasGuardrailIssues && !guardrailsOverridden ? (
              <>
                <ShieldAlert className="h-4 w-4 mr-2" />
                Override & Assign
              </>
            ) : (
              <>
                <UserPlus className="h-4 w-4 mr-2" />
                Assign {selectedUsers.length} Staff to {selectedEvents.length} Event
                {selectedEvents.length > 1 && 's'}
              </>
            )}
          </Button>
        </div>

        {/* Guardrail Override Dialog */}
        <GuardrailOverrideDialog
          open={showGuardrailDialog}
          onOpenChange={setShowGuardrailDialog}
          hardBlocks={aggregatedHardBlocks}
          softBlocks={aggregatedSoftBlocks}
          eventId={selectedEvents[0]?.id || ''}
          userId={user?.id || ''}
          onOverrideConfirmed={handleGuardrailOverrideConfirmed}
          overrideType="bulk_assignment"
        />
      </DialogContent>
    </Dialog>
  );
}
