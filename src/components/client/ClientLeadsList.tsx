/**
 * CLIENT LEADS LIST
 * 
 * Studio Ninja-style leads list showing:
 * - Lead name with status indicator
 * - Type, Main Shoot dates, Next Task, Lead Source
 * - Actions: View, Edit, Send Email, Archive, Delete
 */
import { Link } from 'react-router-dom';
import { format, parseISO } from 'date-fns';
import { 
  Target, 
  Eye, 
  Pencil, 
  Send, 
  Archive, 
  Trash2,
  Plus,
  Circle 
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useClientLeads, useUpdateLead } from '@/hooks/useSales';
import { CreateLeadDialog } from '@/components/CreateLeadDialog';
import { toast } from 'sonner';

interface LeadWithType {
  id: string;
  updated_at: string;
  lead_name: string;
  status: string | null;
  main_shoot_start?: string | null;
  main_shoot_end?: string | null;
  enquiry_source?: string | null;
  event_type?: { id: string; name: string } | null;
  lead_source?: { id: string; name: string } | null;
}

interface LeadItemProps {
  lead: LeadWithType;
  onSendEmail?: () => void;
  onArchive?: () => void;
  onDelete?: () => void;
}

function LeadItem({ lead, onSendEmail, onArchive, onDelete }: LeadItemProps) {
  // Status color
  const getStatusColor = (status: string | null) => {
    switch (status) {
      case 'new': return 'text-blue-500';
      case 'qualified': return 'text-green-500';
      case 'quoted': return 'text-purple-500';
      case 'accepted': return 'text-emerald-500';
      case 'lost': return 'text-red-500';
      default: return 'text-orange-500';
    }
  };

  return (
    <div className="border rounded-lg p-4 space-y-3">
      {/* Lead Name with Status */}
      <div className="flex items-center gap-2">
        <Circle className={`h-3 w-3 fill-current ${getStatusColor(lead.status)}`} />
        <span className="font-medium">{lead.lead_name}</span>
      </div>
      
      {/* Details Grid */}
      <div className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 text-sm">
        <span className="text-muted-foreground">Type</span>
        <span>{lead.event_type?.name || '-'}</span>
        
        <span className="text-muted-foreground">Main Shoot</span>
        <div>
          {lead.main_shoot_start ? (
            <>
              <div>
                <span className="font-medium">Start</span>
                <div>
                  <span className="text-primary underline">
                    {format(parseISO(lead.main_shoot_start), 'EEE, d MMM yyyy')}
                  </span>
                  {' '}
                  <span>{format(parseISO(lead.main_shoot_start), 'h:mm a')}</span>
                </div>
              </div>
              {lead.main_shoot_end && (
                <div className="mt-1">
                  <span className="font-medium">End</span>
                  <div>
                    <span className="text-primary underline">
                      {format(parseISO(lead.main_shoot_end), 'EEE, d MMM yyyy')}
                    </span>
                    {' '}
                    <span>{format(parseISO(lead.main_shoot_end), 'h:mm a')}</span>
                  </div>
                </div>
              )}
            </>
          ) : (
            '-'
          )}
        </div>
        
        <span className="text-muted-foreground">Lead Source</span>
        <div className="flex items-center gap-1.5">
          {lead.lead_source && (
            <>
              <span className="w-2.5 h-2.5 rounded-sm bg-blue-500" />
              <span>{lead.lead_source.name}</span>
            </>
          )}
          {!lead.lead_source && '-'}
        </div>
      </div>
      
      {/* Actions */}
      <div className="flex flex-wrap gap-2 pt-2">
        <Button variant="outline" size="sm" asChild>
          <Link to={`/sales/leads/${lead.id}`}>
            <Eye className="h-4 w-4 mr-1.5" />
            View
          </Link>
        </Button>
        
        <Button variant="outline" size="sm" asChild>
          <Link to={`/sales/leads/${lead.id}?edit=true`}>
            <Pencil className="h-4 w-4 mr-1.5" />
            Edit
          </Link>
        </Button>
        
        <Button variant="outline" size="sm" onClick={onSendEmail}>
          <Send className="h-4 w-4 mr-1.5" />
          Send email
        </Button>
        
        <Button variant="outline" size="sm" onClick={onArchive}>
          <Archive className="h-4 w-4 mr-1.5" />
          Archive
        </Button>
        
        <Button variant="outline" size="sm" onClick={onDelete}>
          <Trash2 className="h-4 w-4 mr-1.5" />
          Delete
        </Button>
      </div>
    </div>
  );
}

interface ClientLeadsListProps {
  clientId: string;
  onSendEmail?: (leadId: string) => void;
}

export function ClientLeadsList({ clientId, onSendEmail }: ClientLeadsListProps) {
  const { data: leads = [], isLoading } = useClientLeads(clientId);
  const updateLead = useUpdateLead();
  
  const handleArchive = async (lead: LeadWithType) => {
    try {
      await updateLead.mutateAsync({ id: lead.id, updated_at: lead.updated_at, status: 'lost' });
      toast.success('Lead archived');
    } catch (error) {
      toast.error('Failed to archive lead');
    }
  };
  
  // Filter to only show active leads
  const activeLeads = leads.filter(l => l.status !== 'lost');

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Target className="h-5 w-5 text-muted-foreground" />
            <CardTitle className="text-lg">Leads</CardTitle>
          </div>
          <CreateLeadDialog 
            defaultClientId={clientId}
            trigger={
              <Button 
                size="icon" 
                className="h-7 w-7 rounded-full bg-primary"
              >
                <Plus className="h-4 w-4" />
              </Button>
            }
          />
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {isLoading ? (
          <div className="text-sm text-muted-foreground text-center py-4">
            Loading leads...
          </div>
        ) : activeLeads.length === 0 ? (
          <div className="text-sm text-muted-foreground text-center py-4">
            No leads yet
          </div>
        ) : (
          activeLeads.map((lead) => (
            <LeadItem 
              key={lead.id} 
              lead={lead as LeadWithType}
              onSendEmail={() => onSendEmail?.(lead.id)}
              onArchive={() => handleArchive(lead as LeadWithType)}
              onDelete={() => handleArchive(lead as LeadWithType)}
            />
          ))
        )}
      </CardContent>
    </Card>
  );
}
