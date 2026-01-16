/**
 * SALES PIPELINE VIEW
 * 
 * Kanban-style view of leads by status.
 * Access: Admin, Sales roles only (enforced via RLS)
 */
import { useState } from 'react';
import { Link } from 'react-router-dom';
import { format } from 'date-fns';
import { Target, Calendar, Building2, DollarSign, ChevronRight } from 'lucide-react';
import { AppLayout } from '@/components/layout/AppLayout';
import { PageHeader } from '@/components/layout/PageHeader';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { useLeads, useUpdateLead } from '@/hooks/useSales';
import { useLostReasons } from '@/hooks/useLostReasons';
import { useToast } from '@/hooks/use-toast';

type LeadStatus = 'new' | 'qualified' | 'quoted' | 'accepted' | 'lost';

const COLUMNS: { status: LeadStatus; label: string; color: string }[] = [
  { status: 'new', label: 'New', color: 'bg-blue-500' },
  { status: 'qualified', label: 'Qualified', color: 'bg-yellow-500' },
  { status: 'quoted', label: 'Quoted', color: 'bg-purple-500' },
  { status: 'accepted', label: 'Won', color: 'bg-green-500' },
  { status: 'lost', label: 'Lost', color: 'bg-gray-400' },
];

export default function PipelineView() {
  const { data: leads, isLoading } = useLeads();
  const { data: lostReasons } = useLostReasons();
  const updateLead = useUpdateLead();
  const { toast } = useToast();
  const [draggedLeadId, setDraggedLeadId] = useState<string | null>(null);
  const [isLostDialogOpen, setIsLostDialogOpen] = useState(false);
  const [pendingLostLeadId, setPendingLostLeadId] = useState<string | null>(null);
  const [selectedLostReasonId, setSelectedLostReasonId] = useState<string>('');

  const leadsByStatus = COLUMNS.reduce((acc, col) => {
    acc[col.status] = leads?.filter(l => l.status === col.status) || [];
    return acc;
  }, {} as Record<LeadStatus, typeof leads>);

  const handleDragStart = (e: React.DragEvent, leadId: string) => {
    setDraggedLeadId(leadId);
    e.dataTransfer.effectAllowed = 'move';
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
  };

  const handleDrop = async (e: React.DragEvent, newStatus: LeadStatus) => {
    e.preventDefault();
    if (!draggedLeadId) return;

    const lead = leads?.find(l => l.id === draggedLeadId);
    if (!lead || lead.status === newStatus) {
      setDraggedLeadId(null);
      return;
    }

    // Can't move accepted leads
    if (lead.status === 'accepted') {
      toast({ 
        title: 'Cannot move accepted lead', 
        description: 'This lead has been converted to an event.',
        variant: 'destructive' 
      });
      setDraggedLeadId(null);
      return;
    }

    // If moving to lost, require a reason
    if (newStatus === 'lost') {
      setPendingLostLeadId(draggedLeadId);
      setIsLostDialogOpen(true);
      setDraggedLeadId(null);
      return;
    }

    try {
      await updateLead.mutateAsync({
        id: draggedLeadId,
        status: newStatus,
      });
      toast({ title: `Lead moved to ${COLUMNS.find(c => c.status === newStatus)?.label || newStatus}` });
    } catch (error) {
      // Error handled by mutation
    }

    setDraggedLeadId(null);
  };

  const handleConfirmLost = async () => {
    if (!pendingLostLeadId || !selectedLostReasonId) return;

    try {
      await updateLead.mutateAsync({
        id: pendingLostLeadId,
        status: 'lost',
        lost_reason_id: selectedLostReasonId,
      });
      toast({ title: 'Lead marked as lost' });
    } catch (error) {
      // Error handled by mutation
    }

    setIsLostDialogOpen(false);
    setPendingLostLeadId(null);
    setSelectedLostReasonId('');
  };

  const getColumnValue = (status: LeadStatus) => {
    const statusLeads = leadsByStatus[status] || [];
    // Sum up quotes for leads in this status
    return statusLeads.reduce((sum, lead) => {
      const quotes = (lead as any).quotes || [];
      return sum + quotes.reduce((qSum: number, q: any) => qSum + (q.total_estimate || 0), 0);
    }, 0);
  };

  if (isLoading) {
    return (
      <AppLayout>
        <div className="flex items-center justify-center py-16">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <PageHeader 
        title="Sales Pipeline" 
        description="Drag leads between stages to update their status"
        actions={
          <Button asChild>
            <Link to="/sales/leads/new">+ New Lead</Link>
          </Button>
        }
      />

      <div className="grid grid-cols-5 gap-4 h-[calc(100vh-200px)]">
        {COLUMNS.map((col) => (
          <Card
            key={col.status}
            className="flex flex-col"
            onDragOver={handleDragOver}
            onDrop={(e) => handleDrop(e, col.status)}
          >
            <CardHeader className="py-3 px-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className={`w-3 h-3 rounded-full ${col.color}`} />
                  <CardTitle className="text-sm font-medium">{col.label}</CardTitle>
                </div>
                <Badge variant="secondary" className="text-xs">
                  {leadsByStatus[col.status]?.length || 0}
                </Badge>
              </div>
              <div className="text-xs text-muted-foreground mt-1">
                ${getColumnValue(col.status).toLocaleString()}
              </div>
            </CardHeader>
            <ScrollArea className="flex-1 px-2">
              <CardContent className="space-y-2 p-2">
                {leadsByStatus[col.status]?.map((lead) => (
                  <div
                    key={lead.id}
                    draggable
                    onDragStart={(e) => handleDragStart(e, lead.id)}
                    className={`
                      p-3 rounded-lg border bg-card cursor-grab active:cursor-grabbing
                      hover:shadow-md transition-shadow
                      ${draggedLeadId === lead.id ? 'opacity-50' : ''}
                    `}
                  >
                    <Link to={`/sales/leads/${lead.id}`} className="block">
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex-1 min-w-0">
                          <h4 className="font-medium text-sm truncate">{lead.lead_name}</h4>
                          {lead.client && (
                            <div className="flex items-center gap-1 text-xs text-muted-foreground mt-1">
                              <Building2 className="h-3 w-3" />
                              <span className="truncate">{lead.client.business_name}</span>
                            </div>
                          )}
                        </div>
                        <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0" />
                      </div>
                      
                      <div className="flex items-center gap-3 mt-2 text-xs text-muted-foreground">
                        {lead.estimated_event_date && (
                          <div className="flex items-center gap-1">
                            <Calendar className="h-3 w-3" />
                            <span>{format(new Date(lead.estimated_event_date), 'MMM d')}</span>
                          </div>
                        )}
                        {(lead as any).quotes?.[0]?.total_estimate && (
                          <div className="flex items-center gap-1">
                            <DollarSign className="h-3 w-3" />
                            <span>${((lead as any).quotes[0].total_estimate).toLocaleString()}</span>
                          </div>
                        )}
                      </div>
                    </Link>
                  </div>
                ))}
                {(!leadsByStatus[col.status] || leadsByStatus[col.status]?.length === 0) && (
                  <div className="text-center py-8 text-muted-foreground text-sm">
                    No leads
                  </div>
                )}
              </CardContent>
            </ScrollArea>
          </Card>
        ))}
      </div>

      {/* Lost Reason Dialog */}
      <Dialog open={isLostDialogOpen} onOpenChange={setIsLostDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Mark Lead as Lost</DialogTitle>
            <DialogDescription>
              Please select a reason for losing this lead.
            </DialogDescription>
          </DialogHeader>
          <div className="py-4">
            <Label htmlFor="lost_reason">Lost Reason *</Label>
            <Select value={selectedLostReasonId} onValueChange={setSelectedLostReasonId}>
              <SelectTrigger className="mt-2">
                <SelectValue placeholder="Select a reason" />
              </SelectTrigger>
              <SelectContent>
                {lostReasons?.map((reason) => (
                  <SelectItem key={reason.id} value={reason.id}>
                    {reason.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsLostDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleConfirmLost} disabled={!selectedLostReasonId}>
              Confirm
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AppLayout>
  );
}
