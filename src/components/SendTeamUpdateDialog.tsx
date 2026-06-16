/**
 * SEND TEAM UPDATE DIALOG
 * 
 * Shows a review dialog with the list of team members who will receive
 * the update notification before sending.
 */
import { useState } from 'react';
import { Users, Send, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Checkbox } from '@/components/ui/checkbox';
import { useSendNotification } from '@/hooks/useNotifications';

interface TeamMember {
  id: string;
  name: string;
  email?: string;
  role?: string;
}

interface SendTeamUpdateDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  eventId: string;
  eventName: string;
  assignments: any[];
}

export function SendTeamUpdateDialog({
  open,
  onOpenChange,
  eventId,
  eventName,
  assignments,
}: SendTeamUpdateDialogProps) {
  const sendNotification = useSendNotification();
  const [sending, setSending] = useState(false);

  // Build unique team members from assignments
  const teamMembers: TeamMember[] = [];
  const seenIds = new Set<string>();
  
  for (const a of assignments) {
    const userId = a.user_id || a.staff?.id;
    if (!userId || seenIds.has(userId)) continue;
    seenIds.add(userId);
    teamMembers.push({
      id: userId,
      name: a.profile?.full_name || a.staff?.name || 'Unknown',
      email: a.profile?.email || a.staff?.email || undefined,
      role: a.staff_role?.name || a.role_on_event || undefined,
    });
  }

  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  // Default to all selected when dialog opens or membership changes
  const memberIdsKey = teamMembers.map(m => m.id).join(',');
  useEffect(() => {
    if (open) {
      setSelectedIds(new Set(teamMembers.map(m => m.id)));
    }
  }, [open, memberIdsKey]);

  const toggleOne = (id: string) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const allSelected = teamMembers.length > 0 && selectedIds.size === teamMembers.length;
  const toggleAll = () => {
    setSelectedIds(allSelected ? new Set() : new Set(teamMembers.map(m => m.id)));
  };

  const selectedCount = selectedIds.size;

  const handleSend = async () => {
    setSending(true);
    try {
      await sendNotification.mutateAsync({
        type: 'event_update',
        event_id: eventId,
        user_ids: Array.from(selectedIds),
      });
      onOpenChange(false);
    } finally {
      setSending(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Users className="h-5 w-5" />
            Send Updated Details to Team
          </DialogTitle>
          <DialogDescription>
            This will send an update notification to selected team members for <strong>{eventName}</strong>.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-2 py-2">
          <div className="flex items-center justify-between">
            <p className="text-sm font-medium text-muted-foreground">
              Recipients ({selectedCount} of {teamMembers.length})
            </p>
            {teamMembers.length > 0 && (
              <button
                type="button"
                onClick={toggleAll}
                className="text-xs text-primary hover:underline"
              >
                {allSelected ? 'Deselect all' : 'Select all'}
              </button>
            )}
          </div>
          <div className="space-y-1.5 max-h-64 overflow-y-auto">
            {teamMembers.map((member) => (
              <label
                key={member.id}
                className="flex items-center gap-3 p-2.5 rounded-lg bg-muted/50 cursor-pointer hover:bg-muted"
              >
                <Checkbox
                  checked={selectedIds.has(member.id)}
                  onCheckedChange={() => toggleOne(member.id)}
                />
                <div className="min-w-0 flex-1">
                  <p className="font-medium text-sm">{member.name}</p>
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    {member.role && <span>{member.role}</span>}
                    {member.role && member.email && <span>·</span>}
                    {member.email && <span className="truncate">{member.email}</span>}
                  </div>
                </div>
              </label>
            ))}
          </div>
          {teamMembers.length === 0 && (
            <p className="text-sm text-muted-foreground text-center py-4">
              No team members assigned.
            </p>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button 
            onClick={handleSend} 
            disabled={sending || selectedCount === 0}
          >
            {sending ? (
              <Loader2 className="h-4 w-4 animate-spin mr-1.5" />
            ) : (
              <Send className="h-4 w-4 mr-1.5" />
            )}
            {sending ? 'Sending...' : `Send to ${selectedCount} Team Member${selectedCount !== 1 ? 's' : ''}`}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
