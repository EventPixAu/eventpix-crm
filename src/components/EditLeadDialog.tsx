/**
 * EDIT LEAD DIALOG
 * 
 * Dialog for editing lead details including client assignment.
 * A lead can exist before a client is assigned.
 */
import { useState, useEffect } from 'react';
import { Pencil, MapPin } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useClients, useUpdateLead } from '@/hooks/useSales';
import { useEventTypes } from '@/hooks/useLookups';
import { useLeadSources } from '@/hooks/useLeadSources';

interface Lead {
  id: string;
  lead_name: string;
  client_id?: string | null;
  event_type_id?: string | null;
  lead_source_id?: string | null;
  estimated_event_date?: string | null;
  notes?: string | null;
  status: string;
  updated_at: string;
  source?: string | null;
  venue_text?: string | null;
}

interface EditLeadDialogProps {
  lead: Lead;
  trigger?: React.ReactNode;
}

export function EditLeadDialog({ lead, trigger }: EditLeadDialogProps) {
  const [open, setOpen] = useState(false);
  const { data: clients } = useClients();
  const { data: eventTypes } = useEventTypes();
  const { data: leadSources } = useLeadSources();
  const updateLead = useUpdateLead();

  const [formData, setFormData] = useState({
    lead_name: '',
    client_id: '',
    event_type_id: '',
    lead_source_id: '',
    estimated_event_date: '',
    venue_text: '',
    notes: '',
    status: '',
  });

  const statusOptions = [
    { value: 'new', label: 'New Lead' },
    { value: 'qualified', label: 'Qualified' },
    { value: 'quoted', label: 'Quoted' },
    { value: 'contract_sent', label: 'Contract Sent' },
    { value: 'won', label: 'Won' },
    { value: 'lost', label: 'Lost' },
  ];

  // Reset form when dialog opens
  useEffect(() => {
    if (open) {
      setFormData({
        lead_name: lead.lead_name || '',
        client_id: lead.client_id || '',
        event_type_id: lead.event_type_id || '',
        lead_source_id: lead.lead_source_id || '',
        estimated_event_date: lead.estimated_event_date || '',
        venue_text: lead.venue_text || '',
        notes: lead.notes || '',
        status: lead.status || 'new',
      });
    }
  }, [open, lead]);

  const handleSave = async () => {
    if (!formData.lead_name.trim()) return;

    await updateLead.mutateAsync({
      id: lead.id,
      updated_at: lead.updated_at,
      lead_name: formData.lead_name,
      client_id: formData.client_id || null,
      event_type_id: formData.event_type_id || null,
      lead_source_id: formData.lead_source_id || null,
      estimated_event_date: formData.estimated_event_date || null,
      venue_text: formData.venue_text || null,
      notes: formData.notes || null,
      status: formData.status as 'new' | 'qualified' | 'quoted' | 'contract_sent' | 'won' | 'lost' | 'accepted',
    });
    
    setOpen(false);
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {trigger || (
          <Button variant="outline" size="sm">
            <Pencil className="h-4 w-4 mr-2" />
            Edit Lead
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Edit Lead</DialogTitle>
          <DialogDescription>
            Update lead details. Assign a client to enable contact management.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="edit_lead_name">Lead Name *</Label>
            <Input
              id="edit_lead_name"
              value={formData.lead_name}
              onChange={(e) => setFormData({ ...formData, lead_name: e.target.value })}
              placeholder="Company Annual Gala 2026"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="edit_status">Status</Label>
            <Select 
              value={formData.status} 
              onValueChange={(value) => setFormData({ ...formData, status: value })}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select status" />
              </SelectTrigger>
              <SelectContent>
                {statusOptions.map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          
          <div className="space-y-2">
            <Label htmlFor="edit_client_id">
              Client
              <span className="text-xs text-muted-foreground ml-2">
                (required for contacts)
              </span>
            </Label>
            <Select 
              value={formData.client_id} 
              onValueChange={(value) => setFormData({ ...formData, client_id: value === '__none__' ? '' : value })}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select a client" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__none__">No client assigned</SelectItem>
                {clients?.map((client) => (
                  <SelectItem key={client.id} value={client.id}>
                    {client.business_name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="edit_event_type_id">Event Type</Label>
            <Select 
              value={formData.event_type_id} 
              onValueChange={(value) => setFormData({ ...formData, event_type_id: value === '__none__' ? '' : value })}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select event type" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__none__">Not specified</SelectItem>
                {eventTypes?.map((type) => (
                  <SelectItem key={type.id} value={type.id}>
                    {type.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="edit_lead_source_id">Lead Source</Label>
            <Select 
              value={formData.lead_source_id} 
              onValueChange={(value) => setFormData({ ...formData, lead_source_id: value === '__none__' ? '' : value })}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select lead source" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__none__">Not specified</SelectItem>
                {leadSources?.map((source) => (
                  <SelectItem key={source.id} value={source.id}>
                    {source.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="edit_estimated_event_date">Estimated Event Date</Label>
            <Input
              id="edit_estimated_event_date"
              type="date"
              value={formData.estimated_event_date}
              onChange={(e) => setFormData({ ...formData, estimated_event_date: e.target.value })}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="edit_venue_text" className="flex items-center gap-1">
              <MapPin className="h-3 w-3" />
              Venue
            </Label>
            <Input
              id="edit_venue_text"
              value={formData.venue_text}
              onChange={(e) => setFormData({ ...formData, venue_text: e.target.value })}
              placeholder="Venue name or address"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="edit_notes">Notes</Label>
            <Textarea
              id="edit_notes"
              value={formData.notes}
              onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
              placeholder="Additional notes..."
              rows={3}
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>
            Cancel
          </Button>
          <Button 
            onClick={handleSave} 
            disabled={!formData.lead_name.trim() || updateLead.isPending}
          >
            {updateLead.isPending ? 'Saving...' : 'Save Changes'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
