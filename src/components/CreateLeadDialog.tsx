/**
 * CREATE LEAD DIALOG
 * 
 * Modal dialog for creating new leads with:
 * - Company selection (existing or new)
 * - Primary contact details
 * - Event type and lead source
 * - Estimated event date
 * 
 * Access: Admin, Sales roles only
 */
import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { format } from 'date-fns';
import { Target, Plus, Building2, CalendarIcon, User } from 'lucide-react';
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
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useClients, useCreateClient, useCreateLead } from '@/hooks/useSales';
import { useEventTypes } from '@/hooks/useLookups';
import { useLeadSources } from '@/hooks/useLeadSources';
import { useAuth } from '@/lib/auth';
import { cn } from '@/lib/utils';

interface CreateLeadDialogProps {
  trigger?: React.ReactNode;
  defaultClientId?: string;
}

export function CreateLeadDialog({ trigger, defaultClientId }: CreateLeadDialogProps) {
  const navigate = useNavigate();
  const { isAdmin, isSales } = useAuth();
  const [open, setOpen] = useState(false);
  
  // Data hooks
  const { data: clients = [] } = useClients();
  const { data: eventTypes = [] } = useEventTypes();
  const { data: leadSources = [] } = useLeadSources();
  const createClient = useCreateClient();
  const createLead = useCreateLead();
  
  // Form state - Company Tab
  const [companyTab, setCompanyTab] = useState<'existing' | 'new'>(defaultClientId ? 'existing' : 'existing');
  const [selectedClientId, setSelectedClientId] = useState<string>(defaultClientId || '');
  const [newCompanyName, setNewCompanyName] = useState('');
  
  // Form state - Primary Contact
  const [contactName, setContactName] = useState('');
  const [contactEmail, setContactEmail] = useState('');
  const [contactPhone, setContactPhone] = useState('');
  
  // Form state - Lead Details
  const [eventName, setEventName] = useState('');
  const [eventTypeId, setEventTypeId] = useState('');
  const [leadSourceId, setLeadSourceId] = useState('');
  const [estimatedDate, setEstimatedDate] = useState<Date | undefined>();
  const [notes, setNotes] = useState('');
  
  // Reset form when dialog opens/closes
  useEffect(() => {
    if (open) {
      setSelectedClientId(defaultClientId || '');
      setCompanyTab(defaultClientId ? 'existing' : 'existing');
      setNewCompanyName('');
      setContactName('');
      setContactEmail('');
      setContactPhone('');
      setEventName('');
      setEventTypeId('');
      setLeadSourceId('');
      setEstimatedDate(undefined);
      setNotes('');
    }
  }, [open, defaultClientId]);
  
  // Auto-populate contact from selected client
  useEffect(() => {
    if (selectedClientId && companyTab === 'existing') {
      const client = clients.find(c => c.id === selectedClientId);
      if (client) {
        setContactName(client.primary_contact_name || '');
        setContactEmail(client.primary_contact_email || '');
        setContactPhone(client.primary_contact_phone || '');
      }
    }
  }, [selectedClientId, companyTab, clients]);
  
  // Generate lead name
  const generateLeadName = () => {
    const companyName = companyTab === 'existing' 
      ? clients.find(c => c.id === selectedClientId)?.business_name 
      : newCompanyName;
    
    if (companyName && eventName) {
      return `${companyName} - ${eventName}`;
    }
    return eventName || companyName || '';
  };
  
  // Validation
  const isCompanyValid = companyTab === 'existing' 
    ? !!selectedClientId 
    : newCompanyName.trim().length > 0;
  
  const isContactValid = contactName.trim().length > 0 && contactEmail.trim().length > 0;
  
  const isFormValid = isCompanyValid && isContactValid && eventName.trim().length > 0;
  
  const isSubmitting = createClient.isPending || createLead.isPending;
  
  // Submit handler
  const handleSubmit = async () => {
    if (!isFormValid) return;
    
    try {
      let clientId = selectedClientId;
      
      // Create new company if needed
      if (companyTab === 'new') {
        const newClient = await createClient.mutateAsync({
          business_name: newCompanyName.trim(),
          primary_contact_name: contactName.trim(),
          primary_contact_email: contactEmail.trim(),
          primary_contact_phone: contactPhone.trim() || null,
        });
        clientId = newClient.id;
      }
      
      // Create the lead
      const leadName = generateLeadName();
      const newLead = await createLead.mutateAsync({
        lead_name: leadName,
        client_id: clientId || null,
        event_type_id: eventTypeId || null,
        lead_source_id: leadSourceId || null,
        estimated_event_date: estimatedDate ? format(estimatedDate, 'yyyy-MM-dd') : null,
        notes: notes.trim() || null,
        status: 'new',
      });
      
      // Close dialog and navigate to lead detail
      setOpen(false);
      navigate(`/sales/leads/${newLead.id}`);
    } catch (error) {
      // Error handling is done in the mutation hooks
      console.error('Failed to create lead:', error);
    }
  };
  
  // Only show to Admin and Sales roles
  if (!isAdmin && !isSales) {
    return null;
  }
  
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {trigger || (
          <Button className="bg-gradient-primary hover:opacity-90">
            <Plus className="h-4 w-4 mr-2" />
            New Lead
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="sm:max-w-[600px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Target className="h-5 w-5" />
            Create New Lead
          </DialogTitle>
          <DialogDescription>
            Add a new sales lead. All fields marked with * are required.
          </DialogDescription>
        </DialogHeader>
        
        <div className="space-y-6 py-4">
          {/* Company Selection */}
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <Building2 className="h-4 w-4 text-muted-foreground" />
              <Label className="text-sm font-medium">Company *</Label>
            </div>
            <Tabs value={companyTab} onValueChange={(v) => setCompanyTab(v as 'existing' | 'new')}>
              <TabsList className="w-full">
                <TabsTrigger value="existing" className="flex-1">Existing Company</TabsTrigger>
                <TabsTrigger value="new" className="flex-1">New Prospect</TabsTrigger>
              </TabsList>
              <TabsContent value="existing" className="mt-3">
                <Select value={selectedClientId} onValueChange={setSelectedClientId}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select a company..." />
                  </SelectTrigger>
                  <SelectContent>
                    {clients.map((client) => (
                      <SelectItem key={client.id} value={client.id}>
                        {client.business_name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </TabsContent>
              <TabsContent value="new" className="mt-3">
                <Input
                  placeholder="Company name..."
                  value={newCompanyName}
                  onChange={(e) => setNewCompanyName(e.target.value)}
                />
              </TabsContent>
            </Tabs>
          </div>
          
          {/* Primary Contact */}
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <User className="h-4 w-4 text-muted-foreground" />
              <Label className="text-sm font-medium">Primary Contact *</Label>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div className="md:col-span-2">
                <Input
                  placeholder="Contact name *"
                  value={contactName}
                  onChange={(e) => setContactName(e.target.value)}
                />
              </div>
              <Input
                type="email"
                placeholder="Email *"
                value={contactEmail}
                onChange={(e) => setContactEmail(e.target.value)}
              />
              <Input
                type="tel"
                placeholder="Phone"
                value={contactPhone}
                onChange={(e) => setContactPhone(e.target.value)}
              />
            </div>
          </div>
          
          {/* Event Details */}
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <Target className="h-4 w-4 text-muted-foreground" />
              <Label className="text-sm font-medium">Event Details</Label>
            </div>
            <Input
              placeholder="Event name *"
              value={eventName}
              onChange={(e) => setEventName(e.target.value)}
            />
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <Select value={eventTypeId} onValueChange={setEventTypeId}>
                <SelectTrigger>
                  <SelectValue placeholder="Event type" />
                </SelectTrigger>
                <SelectContent>
                  {eventTypes.map((type) => (
                    <SelectItem key={type.id} value={type.id}>
                      {type.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select value={leadSourceId} onValueChange={setLeadSourceId}>
                <SelectTrigger>
                  <SelectValue placeholder="Lead source" />
                </SelectTrigger>
                <SelectContent>
                  {leadSources.map((source) => (
                    <SelectItem key={source.id} value={source.id}>
                      {source.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <Popover>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  className={cn(
                    "w-full justify-start text-left font-normal",
                    !estimatedDate && "text-muted-foreground"
                  )}
                >
                  <CalendarIcon className="mr-2 h-4 w-4" />
                  {estimatedDate ? format(estimatedDate, 'PPP') : 'Estimated event date'}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar
                  mode="single"
                  selected={estimatedDate}
                  onSelect={setEstimatedDate}
                  initialFocus
                  className={cn("p-3 pointer-events-auto")}
                />
              </PopoverContent>
            </Popover>
          </div>
          
          {/* Notes */}
          <div className="space-y-3">
            <Label className="text-sm font-medium">Notes</Label>
            <Textarea
              placeholder="Additional notes or requirements..."
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={3}
            />
          </div>
          
          {/* Lead Name Preview */}
          {generateLeadName() && (
            <div className="p-3 bg-muted rounded-lg">
              <p className="text-xs text-muted-foreground mb-1">Lead will be created as:</p>
              <p className="font-medium text-sm">{generateLeadName()}</p>
            </div>
          )}
        </div>
        
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)} disabled={isSubmitting}>
            Cancel
          </Button>
          <Button 
            onClick={handleSubmit} 
            disabled={!isFormValid || isSubmitting}
            className="bg-gradient-primary hover:opacity-90"
          >
            {isSubmitting ? 'Creating...' : 'Create Lead'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
