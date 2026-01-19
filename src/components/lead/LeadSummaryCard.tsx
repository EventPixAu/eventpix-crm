/**
 * LEAD SUMMARY CARD
 * 
 * Studio Ninja-style lead summary showing:
 * - Lead name with status indicator
 * - Type, Workflow, Main Shoot dates
 * - Lead source
 * - Edit, Archive, Delete actions
 */
import { format } from 'date-fns';
import { Link } from 'react-router-dom';
import { Pencil, Archive, Trash2, Target } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { EditLeadDialog } from '@/components/EditLeadDialog';
import { useUpdateLead } from '@/hooks/useSales';
import { useToast } from '@/hooks/use-toast';
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
    lead_name: string;
    status: string;
    client_id?: string | null;
    event_type_id?: string | null;
    lead_source_id?: string | null;
    estimated_event_date?: string | null;
    notes?: string | null;
    source?: string | null;
  };
  eventType?: { id: string; name: string } | null;
  leadSource?: { id: string; name: string } | null;
  workflowName?: string;
  mainShootStart?: string | null;
  mainShootEnd?: string | null;
  onArchive?: () => void;
  onDelete?: () => void;
}

const STATUS_COLORS: Record<string, string> = {
  new: 'bg-amber-400',
  qualified: 'bg-purple-400',
  quoted: 'bg-blue-400',
  accepted: 'bg-emerald-400',
  lost: 'bg-gray-400',
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
}: LeadSummaryCardProps) {
  const updateLead = useUpdateLead();
  const { toast } = useToast();

  const handleArchive = async () => {
    await updateLead.mutateAsync({
      id: lead.id,
      status: 'lost',
    });
    toast({ title: 'Lead archived' });
    onArchive?.();
  };

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center gap-2">
          <Target className="h-5 w-5 text-muted-foreground" />
          <CardTitle className="text-lg">Lead</CardTitle>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Lead name with status dot */}
        <div className="flex items-center gap-2">
          <div className={`h-2.5 w-2.5 rounded-full ${STATUS_COLORS[lead.status] || 'bg-gray-400'}`} />
          <span className="font-semibold text-lg">{lead.lead_name}</span>
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

        {/* Actions */}
        <div className="flex gap-2 pt-2 border-t">
          <EditLeadDialog 
            lead={{
              id: lead.id,
              lead_name: lead.lead_name,
              client_id: lead.client_id,
              event_type_id: lead.event_type_id,
              lead_source_id: lead.lead_source_id,
              estimated_event_date: lead.estimated_event_date,
              notes: lead.notes,
              status: lead.status,
              source: lead.source,
            }}
            trigger={
              <Button variant="outline" size="sm">
                <Pencil className="h-4 w-4 mr-1.5" />
                Edit
              </Button>
            }
          />
          
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
