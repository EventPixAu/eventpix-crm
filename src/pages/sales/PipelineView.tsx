/**
 * SALES PIPELINE VIEW
 * 
 * Studio Ninja-style Kanban pipeline with 6 stages:
 * - New Lead: Fresh inquiries from website
 * - Qualified: Validated and worth pursuing
 * - Quoted: Quote has been sent
 * - Contract Sent: Contract has been issued
 * - Won: Deal closed, converted to event
 * - Lost: Deal lost (requires reason)
 * 
 * Access: Admin, Sales roles only (enforced via RLS)
 */
import { useState } from 'react';
import { Link } from 'react-router-dom';
import { format } from 'date-fns';
import { Calendar, Building2, DollarSign, ChevronRight, Lock, FileText, Send } from 'lucide-react';
import { AppLayout } from '@/components/layout/AppLayout';
import { PageHeader } from '@/components/layout/PageHeader';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Button } from '@/components/ui/button';
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
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { useLeads, useUpdateLead } from '@/hooks/useSales';
import { useLostReasons } from '@/hooks/useLostReasons';
import { toast } from 'sonner';

// Studio Ninja-style pipeline stages
type LeadStatus = 'new' | 'qualified' | 'quoted' | 'contract_sent' | 'won' | 'accepted' | 'lost';

interface PipelineColumn {
  status: LeadStatus;
  label: string;
  color: string;
  icon?: React.ReactNode;
  description: string;
  canDragTo: LeadStatus[];
}

const COLUMNS: PipelineColumn[] = [
  { 
    status: 'new', 
    label: 'New Lead', 
    color: 'bg-sky-500',
    description: 'Fresh inquiries from website',
    canDragTo: ['qualified', 'lost']
  },
  { 
    status: 'qualified', 
    label: 'Qualified', 
    color: 'bg-amber-500',
    description: 'Validated and worth pursuing',
    canDragTo: ['quoted', 'lost']
  },
  { 
    status: 'quoted', 
    label: 'Budget Sent', 
    color: 'bg-violet-500',
    icon: <DollarSign className="h-3 w-3" />,
    description: 'Budget has been sent',
    canDragTo: ['contract_sent', 'lost']
  },
  { 
    status: 'contract_sent', 
    label: 'Contract Sent', 
    color: 'bg-indigo-500',
    icon: <FileText className="h-3 w-3" />,
    description: 'Contract issued, awaiting signature',
    canDragTo: ['won', 'lost']
  },
  { 
    status: 'won', 
    label: 'Won', 
    color: 'bg-emerald-500',
    description: 'Deal closed, converted to event',
    canDragTo: [] // Terminal state
  },
  { 
    status: 'lost', 
    label: 'Lost', 
    color: 'bg-slate-400',
    description: 'Deal lost',
    canDragTo: [] // Terminal state (could allow revival to 'new')
  },
];

// Map legacy 'accepted' status to 'won' for display
const normalizeStatus = (status: string): LeadStatus => {
  if (status === 'accepted') return 'won';
  return status as LeadStatus;
};

export default function PipelineView() {
  const { data: leads, isLoading } = useLeads();
  const { data: lostReasons } = useLostReasons();
  const updateLead = useUpdateLead();
  const [draggedLeadId, setDraggedLeadId] = useState<string | null>(null);
  const [dragOverColumn, setDragOverColumn] = useState<LeadStatus | null>(null);
  const [isLostDialogOpen, setIsLostDialogOpen] = useState(false);
  const [pendingLostLeadId, setPendingLostLeadId] = useState<string | null>(null);
  const [selectedLostReasonId, setSelectedLostReasonId] = useState<string>('');

  // Group leads by status, normalizing 'accepted' to 'won'
  const leadsByStatus = COLUMNS.reduce((acc, col) => {
    acc[col.status] = leads?.filter(l => {
      const normalized = normalizeStatus(l.status);
      return normalized === col.status;
    }) || [];
    return acc;
  }, {} as Record<LeadStatus, typeof leads>);

  const getValidTransitions = (currentStatus: LeadStatus): LeadStatus[] => {
    const column = COLUMNS.find(c => c.status === currentStatus);
    return column?.canDragTo || [];
  };

  const handleDragStart = (e: React.DragEvent, leadId: string, currentStatus: string) => {
    setDraggedLeadId(leadId);
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', leadId);
  };

  const handleDragOver = (e: React.DragEvent, columnStatus: LeadStatus) => {
    e.preventDefault();
    
    if (!draggedLeadId) return;
    
    const lead = leads?.find(l => l.id === draggedLeadId);
    if (!lead) return;
    
    const currentStatus = normalizeStatus(lead.status);
    const validTransitions = getValidTransitions(currentStatus);
    
    if (validTransitions.includes(columnStatus)) {
      e.dataTransfer.dropEffect = 'move';
      setDragOverColumn(columnStatus);
    } else {
      e.dataTransfer.dropEffect = 'none';
    }
  };

  const handleDragLeave = () => {
    setDragOverColumn(null);
  };

  const handleDrop = async (e: React.DragEvent, newStatus: LeadStatus) => {
    e.preventDefault();
    setDragOverColumn(null);
    
    if (!draggedLeadId) return;

    const lead = leads?.find(l => l.id === draggedLeadId);
    if (!lead) {
      setDraggedLeadId(null);
      return;
    }

    const currentStatus = normalizeStatus(lead.status);
    
    // Same column - no action
    if (currentStatus === newStatus) {
      setDraggedLeadId(null);
      return;
    }

    // Check valid transitions
    const validTransitions = getValidTransitions(currentStatus);
    if (!validTransitions.includes(newStatus)) {
      const currentColumn = COLUMNS.find(c => c.status === currentStatus);
      const targetColumn = COLUMNS.find(c => c.status === newStatus);
      toast.error('Invalid transition', { description: `Cannot move from "${currentColumn?.label}" directly to "${targetColumn?.label}".` });
      setDraggedLeadId(null);
      return;
    }

    // Terminal states can't be modified
    if (currentStatus === 'won' || currentStatus === 'lost') {
      toast.error('Cannot move', { description: 'This lead is in a terminal state.' });
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

    // Moving to won requires quote acceptance (handled by workflow)
    if (newStatus === 'won') {
      toast.success('Use workflow to close deal', { description: 'Accept the quote and sign the contract to move to Won.' });
      setDraggedLeadId(null);
      return;
    }

    try {
      await updateLead.mutateAsync({
        id: draggedLeadId,
        updated_at: lead.updated_at,
        status: newStatus,
      });
      const targetColumn = COLUMNS.find(c => c.status === newStatus);
      toast.success(`Lead moved to ${targetColumn?.label || newStatus}`);
    } catch (error) {
      // Error handled by mutation
    }

    setDraggedLeadId(null);
  };

  const handleConfirmLost = async () => {
    if (!pendingLostLeadId || !selectedLostReasonId) return;
    const lead = leads?.find(l => l.id === pendingLostLeadId);
    if (!lead) return;

    try {
      await updateLead.mutateAsync({
        id: pendingLostLeadId,
        updated_at: lead.updated_at,
        status: 'lost',
        lost_reason_id: selectedLostReasonId,
      });
      toast.success('Lead marked as lost');
    } catch (error) {
      // Error handled by mutation
    }

    setIsLostDialogOpen(false);
    setPendingLostLeadId(null);
    setSelectedLostReasonId('');
  };

  const getColumnValue = (status: LeadStatus) => {
    const statusLeads = leadsByStatus[status] || [];
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
        description="Drag leads through stages. Won requires completing the quote/contract workflow."
      />

      <TooltipProvider>
        <div className="grid grid-cols-6 gap-3 h-[calc(100vh-200px)]">
          {COLUMNS.map((col) => {
            const isDropTarget = dragOverColumn === col.status;
            const leadCount = leadsByStatus[col.status]?.length || 0;
            const columnValue = getColumnValue(col.status);
            
            return (
              <Card
                key={col.status}
                className={`
                  flex flex-col transition-all duration-200
                  ${isDropTarget ? 'ring-2 ring-primary ring-offset-2' : ''}
                `}
                onDragOver={(e) => handleDragOver(e, col.status)}
                onDragLeave={handleDragLeave}
                onDrop={(e) => handleDrop(e, col.status)}
              >
                <CardHeader className="py-3 px-3">
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <div className={`w-2.5 h-2.5 rounded-full ${col.color}`} />
                          <CardTitle className="text-xs font-medium truncate">{col.label}</CardTitle>
                          {col.icon}
                        </div>
                        <Badge variant="secondary" className="text-xs h-5 px-1.5">
                          {leadCount}
                        </Badge>
                      </div>
                    </TooltipTrigger>
                    <TooltipContent side="top">
                      <p className="text-xs">{col.description}</p>
                    </TooltipContent>
                  </Tooltip>
                  {columnValue > 0 && (
                    <div className="text-xs text-muted-foreground mt-1">
                      ${columnValue.toLocaleString()}
                    </div>
                  )}
                </CardHeader>
                <ScrollArea className="flex-1 px-2">
                  <CardContent className="space-y-2 p-1.5">
                    {leadsByStatus[col.status]?.map((lead) => {
                      const isTerminal = col.status === 'won' || col.status === 'lost';
                      const isDragging = draggedLeadId === lead.id;
                      
                      return (
                        <div
                          key={lead.id}
                          draggable={!isTerminal}
                          onDragStart={(e) => handleDragStart(e, lead.id, lead.status)}
                          className={`
                            p-2.5 rounded-lg border bg-card transition-all
                            ${isTerminal ? 'cursor-default opacity-80' : 'cursor-grab active:cursor-grabbing hover:shadow-md'}
                            ${isDragging ? 'opacity-50 scale-95' : ''}
                          `}
                        >
                          <Link to={`/sales/leads/${lead.id}`} className="block">
                            <div className="flex items-start justify-between gap-1.5">
                              <div className="flex-1 min-w-0">
                                <h4 className="font-medium text-xs truncate">{lead.lead_name}</h4>
                                {lead.client && (
                                  <div className="flex items-center gap-1 text-[10px] text-muted-foreground mt-0.5">
                                    <Building2 className="h-2.5 w-2.5" />
                                    <span className="truncate">{lead.client.business_name}</span>
                                  </div>
                                )}
                              </div>
                              {isTerminal ? (
                                <Lock className="h-3 w-3 text-muted-foreground shrink-0" />
                              ) : (
                                <ChevronRight className="h-3 w-3 text-muted-foreground shrink-0" />
                              )}
                            </div>
                            
                            <div className="flex items-center gap-2 mt-1.5 text-[10px] text-muted-foreground">
                              {lead.estimated_event_date && (
                                <div className="flex items-center gap-0.5">
                                  <Calendar className="h-2.5 w-2.5" />
                                  <span>{format(new Date(lead.estimated_event_date), 'MMM d')}</span>
                                </div>
                              )}
                              {(lead as any).quotes?.[0]?.total_estimate && (
                                <div className="flex items-center gap-0.5">
                                  <DollarSign className="h-2.5 w-2.5" />
                                  <span>${((lead as any).quotes[0].total_estimate).toLocaleString()}</span>
                                </div>
                              )}
                            </div>
                          </Link>
                        </div>
                      );
                    })}
                    {leadCount === 0 && (
                      <div className="text-center py-6 text-muted-foreground text-xs">
                        No leads
                      </div>
                    )}
                  </CardContent>
                </ScrollArea>
              </Card>
            );
          })}
        </div>
      </TooltipProvider>

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
