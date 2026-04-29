/**
 * LEAD SUMMARY CARD
 * 
 * Studio Ninja-style lead summary showing:
 * - Lead name with status indicator
 * - Type, Workflow, Main Shoot dates
 * - Lead source
 * - Edit, Archive, Delete actions
 */
import { useState } from 'react';
import { format } from 'date-fns';
import { Link } from 'react-router-dom';
import { Archive, Trash2, Target, Pencil, MapPin, ArrowRightCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { useUpdateLead } from '@/hooks/useSales';
import { useLeadStatuses } from '@/hooks/useLeadStatuses';
import { toast } from 'sonner';
import { useLostReasons } from '@/hooks/useLostReasons';
import { EditLeadDialog } from '@/components/EditLeadDialog';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
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

interface LeadSummaryCardProps {
  lead: {
    id: string;
    updated_at: string;
    lead_name: string;
    status: string;
    client_id?: string | null;
    event_type_id?: string | null;
    lead_source_id?: string | null;
    estimated_event_date?: string | null;
    notes?: string | null;
    source?: string | null;
    venue_text?: string | null;
  };
  eventType?: { id: string; name: string } | null;
  leadSource?: { id: string; name: string } | null;
  workflowName?: string;
  mainShootStart?: string | null;
  mainShootEnd?: string | null;
  onArchive?: () => void;
  onDelete?: () => void;
  onConvert?: () => void;
}

const VARIANT_MAP: Record<string, 'default' | 'secondary' | 'outline' | 'destructive'> = {
  default: 'default',
  secondary: 'secondary',
  outline: 'outline',
  destructive: 'destructive',
};

export function LeadSummaryCard({
  lead,
  eventType,
  leadSource,
  workflowName,
  mainShootStart,
  mainShootEnd,
  onArchive,
  onDelete,
  onConvert,
}: LeadSummaryCardProps) {
  const updateLead = useUpdateLead();
  const { data: leadStatuses = [] } = useLeadStatuses();

  const { data: lostReasons } = useLostReasons();
  const [lostOpen, setLostOpen] = useState(false);
  const [lostReasonId, setLostReasonId] = useState<string>('');
  const [lostNotes, setLostNotes] = useState('');

  const currentStatus = leadStatuses.find(s => s.name === lead.status);
  const badgeVariant = VARIANT_MAP[currentStatus?.badge_variant || 'secondary'] || 'secondary';

  const handleStatusChange = async (newStatus: string) => {
    if (newStatus === 'lost') {
      setLostOpen(true);
      return;
    }
    // If marking as "won", trigger conversion to event automatically
    if (newStatus === 'won' && !(lead as any).converted_job_id) {
      onConvert?.();
      return;
    }
    await updateLead.mutateAsync({ id: lead.id, updated_at: lead.updated_at, status: newStatus as any });
    toast.success(`Status updated to ${leadStatuses.find(s => s.name === newStatus)?.label || newStatus}`);
  };

  const handleArchive = async () => {
    await updateLead.mutateAsync({
      id: lead.id,
      updated_at: lead.updated_at,
      status: 'lost',
    });
    toast.success('Lead archived');
    onArchive?.();
  };

  const handleMarkAsLost = async () => {
    await updateLead.mutateAsync({
      id: lead.id,
      updated_at: lead.updated_at,
      status: 'lost',
      lost_reason_id: lostReasonId || null,
      notes: lostNotes ? `${lead.notes ? lead.notes + '\n' : ''}Lost: ${lostNotes}` : lead.notes,
    });
    toast.success('Lead marked as lost and archived');
    setLostOpen(false);
    setLostReasonId('');
    setLostNotes('');
    onArchive?.();
  };

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Target className="h-5 w-5 text-muted-foreground" />
            <CardTitle className="text-lg">Lead</CardTitle>
          </div>
          <EditLeadDialog
            lead={lead}
            trigger={
              <Button variant="ghost" size="sm">
                <Pencil className="h-4 w-4 mr-1.5" />
                Edit
              </Button>
            }
          />
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Lead name with status badge */}
        <div className="flex items-center gap-2 flex-wrap">
          <span className="font-semibold text-lg">{lead.lead_name}</span>
          <Badge variant={badgeVariant}>{currentStatus?.label || lead.status}</Badge>
        </div>

        {/* Status selector */}
        <div className="flex justify-between items-center">
          <span className="text-muted-foreground text-sm">Status</span>
          <Select value={lead.status} onValueChange={handleStatusChange}>
            <SelectTrigger className="w-[180px] h-8">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {leadStatuses.map(s => (
                <SelectItem key={s.name} value={s.name}>{s.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Details grid */}
        <div className="grid gap-3 text-sm">
          <div className="flex justify-between">
            <span className="text-muted-foreground">Type</span>
            <span className="font-medium">{eventType?.name || '—'}</span>
          </div>
          
          <div className="flex justify-between">
            <span className="text-muted-foreground">Workflow</span>
            <span className="font-medium">{workflowName || 'No workflow assigned'}</span>
          </div>
          
          <div className="flex justify-between items-start">
            <span className="text-muted-foreground">Main Shoot</span>
            <div className="text-right">
              {mainShootStart ? (
                <>
                  <div className="font-medium">
                    <span className="text-muted-foreground text-xs">Start</span>
                  </div>
                  <div>
                    <Link 
                      to="#" 
                      className="text-primary hover:underline font-medium"
                    >
                      {format(new Date(mainShootStart), 'EEE, d MMM yyyy')}
                    </Link>
                    {' '}
                    <span className="text-muted-foreground">
                      {format(new Date(mainShootStart), 'h:mm a')}
                    </span>
                  </div>
                  {mainShootEnd && (
                    <>
                      <div className="font-medium mt-1">
                        <span className="text-muted-foreground text-xs">End</span>
                      </div>
                      <div>
                        <Link 
                          to="#" 
                          className="text-primary hover:underline font-medium"
                        >
                          {format(new Date(mainShootEnd), 'EEE, d MMM yyyy')}
                        </Link>
                        {' '}
                        <span className="text-muted-foreground">
                          {format(new Date(mainShootEnd), 'h:mm a')}
                        </span>
                      </div>
                    </>
                  )}
                </>
              ) : (
                <span className="text-muted-foreground">Not set</span>
              )}
            </div>
          </div>
          
          {/* Venue */}
          <div className="flex justify-between items-start">
            <span className="text-muted-foreground flex items-center gap-1">
              <MapPin className="h-3 w-3" />
              Venue
            </span>
            <span className="font-medium text-right max-w-[60%]">
              {(lead as any).venue_text || '—'}
            </span>
          </div>
          
          <div className="flex justify-between items-center">
            <span className="text-muted-foreground">Lead Source</span>
            <div className="flex items-center gap-1.5">
              {leadSource && (
                <div className="h-2.5 w-2.5 rounded-sm bg-emerald-400" />
              )}
              <span className="font-medium">{leadSource?.name || lead.source || '—'}</span>
            </div>
          </div>
        </div>

        {/* Lost reason dialog (triggered from status dropdown) */}
        <Dialog open={lostOpen} onOpenChange={setLostOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Mark lead as lost</DialogTitle>
              <DialogDescription>
                Select a reason and optionally add notes. This will move the lead to the Lost stage.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-2">
              <div className="space-y-2">
                <Label>Lost Reason</Label>
                <Select value={lostReasonId} onValueChange={setLostReasonId}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select a reason..." />
                  </SelectTrigger>
                  <SelectContent>
                    {lostReasons?.map((r) => (
                      <SelectItem key={r.id} value={r.id}>{r.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Notes (optional)</Label>
                <Textarea
                  value={lostNotes}
                  onChange={(e) => setLostNotes(e.target.value)}
                  placeholder="Any additional context..."
                  rows={3}
                />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setLostOpen(false)}>Cancel</Button>
              <Button variant="destructive" onClick={handleMarkAsLost} disabled={!lostReasonId}>
                Mark as Lost
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Actions */}
        <div className="flex gap-2 pt-2 border-t">
          {onConvert && (
            <Button variant="default" size="sm" onClick={onConvert}>
              <ArrowRightCircle className="h-4 w-4 mr-1.5" />
              Convert to Event
            </Button>
          )}
          <div className="flex-1" />
          
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button variant="outline" size="sm">
                <Archive className="h-4 w-4 mr-1.5" />
                Archive
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Archive this lead?</AlertDialogTitle>
                <AlertDialogDescription>
                  This will mark the lead as lost. You can still access it from the leads list.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancel</AlertDialogCancel>
                <AlertDialogAction onClick={handleArchive}>Archive</AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
          
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button variant="outline" size="sm">
                <Trash2 className="h-4 w-4 mr-1.5" />
                Delete
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Delete this lead?</AlertDialogTitle>
                <AlertDialogDescription>
                  This action cannot be undone. This will permanently delete the lead and all associated data.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancel</AlertDialogCancel>
                <AlertDialogAction 
                  onClick={onDelete}
                  className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                >
                  Delete
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>
      </CardContent>
    </Card>
  );
}
