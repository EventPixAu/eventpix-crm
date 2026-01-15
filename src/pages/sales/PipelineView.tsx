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
import { useLeads, useUpdateLead } from '@/hooks/useSales';
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
  const updateLead = useUpdateLead();
  const { toast } = useToast();
  const [draggedLeadId, setDraggedLeadId] = useState<string | null>(null);

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

    try {
      await updateLead.mutateAsync({
        id: draggedLeadId,
        status: newStatus,
      });
      toast({ title: `Lead moved to ${newStatus}` });
    } catch (error) {
      // Error handled by mutation
    }

    setDraggedLeadId(null);
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
        description="Track leads through your sales process"
        actions={
          <Link to="/sales/leads">
            <Button variant="outline">
              List View
              <ChevronRight className="h-4 w-4 ml-2" />
            </Button>
          </Link>
        }
      />

      <div className="mt-6 flex gap-4 overflow-x-auto pb-4">
        {COLUMNS.map((column) => (
          <div
            key={column.status}
            className="flex-shrink-0 w-72"
            onDragOver={handleDragOver}
            onDrop={(e) => handleDrop(e, column.status)}
          >
            <Card className="h-full">
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className={`w-3 h-3 rounded-full ${column.color}`} />
                    <CardTitle className="text-sm font-medium">{column.label}</CardTitle>
                  </div>
                  <Badge variant="secondary">
                    {leadsByStatus[column.status]?.length || 0}
                  </Badge>
                </div>
              </CardHeader>
              <CardContent className="pt-0">
                <ScrollArea className="h-[calc(100vh-280px)]">
                  <div className="space-y-3 pr-4">
                    {leadsByStatus[column.status]?.map((lead) => (
                      <Card
                        key={lead.id}
                        className={`cursor-pointer hover:shadow-md transition-shadow ${
                          draggedLeadId === lead.id ? 'opacity-50' : ''
                        } ${column.status === 'accepted' ? 'cursor-not-allowed' : 'cursor-grab'}`}
                        draggable={column.status !== 'accepted'}
                        onDragStart={(e) => handleDragStart(e, lead.id)}
                      >
                        <CardContent className="p-3">
                          <Link 
                            to={`/sales/leads/${lead.id}`}
                            className="block"
                            onClick={(e) => e.stopPropagation()}
                          >
                            <div className="flex items-start justify-between mb-2">
                              <div className="font-medium text-sm line-clamp-2">
                                {lead.lead_name}
                              </div>
                            </div>
                            
                            {(lead.client as any)?.business_name && (
                              <div className="flex items-center gap-1 text-xs text-muted-foreground mb-1">
                                <Building2 className="h-3 w-3" />
                                {(lead.client as any).business_name}
                              </div>
                            )}
                            
                            {lead.estimated_event_date && (
                              <div className="flex items-center gap-1 text-xs text-muted-foreground mb-1">
                                <Calendar className="h-3 w-3" />
                                {format(new Date(lead.estimated_event_date), 'dd MMM yyyy')}
                              </div>
                            )}
                            
                            {(lead.event_type as any)?.name && (
                              <Badge variant="outline" className="text-xs mt-2">
                                {(lead.event_type as any).name}
                              </Badge>
                            )}
                          </Link>
                        </CardContent>
                      </Card>
                    ))}
                    
                    {!leadsByStatus[column.status]?.length && (
                      <div className="text-center py-8 text-sm text-muted-foreground">
                        No leads
                      </div>
                    )}
                  </div>
                </ScrollArea>
              </CardContent>
            </Card>
          </div>
        ))}
      </div>
    </AppLayout>
  );
}
