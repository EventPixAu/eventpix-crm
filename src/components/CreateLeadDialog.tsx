/**
 * CREATE LEAD DIALOG
 * 
 * Modal dialog for creating new leads with:
 * - Company selection (existing or new)
 * - Primary contact details
 * - Event type and lead source
 * - Multiple proposed dates/times
 * 
 * Access: Admin, Sales roles only
 */
import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { format } from 'date-fns';
import { Target, Plus, Building2, CalendarIcon, User, Clock, Trash2, MapPin } from 'lucide-react';
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
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

interface CreateLeadDialogProps {
  trigger?: React.ReactNode;
  defaultClientId?: string;
}

interface ProposedSession {
  id: string;
  date: Date | undefined;
  startTime: string;
  endTime: string;
  label: string;
  venueName: string;
}

const generateTempId = () => `temp-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

export function CreateLeadDialog({ trigger, defaultClientId }: CreateLeadDialogProps) {
  const navigate = useNavigate();
  const { isAdmin, isSales } = useAuth();
  const { toast } = useToast();
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
  const [notes, setNotes] = useState('');
  
  // Form state - Proposed Sessions (multiple dates/times)
  const [proposedSessions, setProposedSessions] = useState<ProposedSession[]>([]);
  
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
      setNotes('');
      setProposedSessions([]);
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
  
  // Session management
  const addSession = () => {
    setProposedSessions(prev => [...prev, {
      id: generateTempId(),
      date: undefined,
      startTime: '',
      endTime: '',
      label: '',
      venueName: '',
    }]);
  };
  
  const updateSession = (id: string, updates: Partial<ProposedSession>) => {
    setProposedSessions(prev => prev.map(s => s.id === id ? { ...s, ...updates } : s));
  };
  
  const removeSession = (id: string) => {
    setProposedSessions(prev => prev.filter(s => s.id !== id));
  };
  
  // Validation
  const isCompanyValid = companyTab === 'existing' 
    ? !!selectedClientId 
    : newCompanyName.trim().length > 0;
  
  const isContactValid = contactName.trim().length > 0 && contactEmail.trim().length > 0;
  
  const isFormValid = isCompanyValid && isContactValid && eventName.trim().length > 0;
  
  const isSubmitting = createClient.isPending || createLead.isPending;
  
  // Get estimated event date from first session or undefined
  const getEstimatedDate = () => {
    const firstSessionWithDate = proposedSessions.find(s => s.date);
    return firstSessionWithDate?.date;
  };
  
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
      const estimatedDate = getEstimatedDate();
      const newLead = await createLead.mutateAsync({
        lead_name: leadName,
        client_id: clientId || null,
        event_type_id: eventTypeId || null,
        lead_source_id: leadSourceId || null,
        estimated_event_date: estimatedDate ? format(estimatedDate, 'yyyy-MM-dd') : null,
        notes: notes.trim() || null,
        status: 'new',
      });
      
      // Create enquiry contact from primary contact
      const { error: contactError } = await supabase
        .from('enquiry_contacts')
        .insert({
          lead_id: newLead.id,
          contact_name: contactName.trim(),
          contact_email: contactEmail.trim(),
          contact_phone: contactPhone.trim() || null,
          role: 'primary',
        });
      
      if (contactError) {
        console.error('Failed to create enquiry contact:', contactError);
      }
      
      // Create event sessions for proposed dates
      const sessionsToCreate = proposedSessions
        .filter(s => s.date) // Only sessions with dates
        .map((s, index) => ({
          lead_id: newLead.id,
          session_date: format(s.date!, 'yyyy-MM-dd'),
          start_time: s.startTime || null,
          end_time: s.endTime || null,
          label: s.label.trim() || null,
          venue_name: s.venueName.trim() || null,
          sort_order: index,
        }));
      
      if (sessionsToCreate.length > 0) {
        const { error: sessionsError } = await supabase
          .from('event_sessions')
          .insert(sessionsToCreate);
        
        if (sessionsError) {
          console.error('Failed to create sessions:', sessionsError);
          toast({
            title: 'Lead created',
            description: 'But some proposed dates could not be saved.',
            variant: 'destructive',
          });
        }
      }
      
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
      <DialogContent className="sm:max-w-[700px] max-h-[90vh] overflow-y-auto">
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
          </div>
          
          {/* Proposed Dates/Times */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <CalendarIcon className="h-4 w-4 text-muted-foreground" />
                <Label className="text-sm font-medium">Proposed Dates & Times</Label>
              </div>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={addSession}
              >
                <Plus className="h-3 w-3 mr-1" />
                Add Date
              </Button>
            </div>
            
            {proposedSessions.length === 0 ? (
              <p className="text-sm text-muted-foreground py-3 text-center border border-dashed rounded-lg">
                No proposed dates added. Click "Add Date" to add event dates.
              </p>
            ) : (
              <div className="space-y-3">
                {proposedSessions.map((session, index) => (
                  <div 
                    key={session.id} 
                    className="p-3 border rounded-lg bg-muted/30 space-y-3"
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-medium text-muted-foreground">
                        Session {index + 1}
                      </span>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => removeSession(session.id)}
                        className="h-7 w-7 p-0 text-muted-foreground hover:text-destructive"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                    
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      {/* Date Picker */}
                      <Popover>
                        <PopoverTrigger asChild>
                          <Button
                            variant="outline"
                            className={cn(
                              "w-full justify-start text-left font-normal",
                              !session.date && "text-muted-foreground"
                            )}
                          >
                            <CalendarIcon className="mr-2 h-4 w-4" />
                            {session.date ? format(session.date, 'PPP') : 'Select date *'}
                          </Button>
                        </PopoverTrigger>
                        <PopoverContent className="w-auto p-0" align="start">
                          <Calendar
                            mode="single"
                            selected={session.date}
                            onSelect={(date) => updateSession(session.id, { date })}
                            initialFocus
                            className={cn("p-3 pointer-events-auto")}
                          />
                        </PopoverContent>
                      </Popover>
                      
                      {/* Session Label */}
                      <Input
                        placeholder="Session label (e.g., Day 1, Awards Night)"
                        value={session.label}
                        onChange={(e) => updateSession(session.id, { label: e.target.value })}
                      />
                    </div>
                    
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                      {/* Start Time */}
                      <div className="flex items-center gap-2">
                        <Clock className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                        <Input
                          type="time"
                          placeholder="Start"
                          value={session.startTime}
                          onChange={(e) => updateSession(session.id, { startTime: e.target.value })}
                          className="text-sm"
                        />
                      </div>
                      
                      {/* End Time */}
                      <div className="flex items-center gap-2">
                        <span className="text-muted-foreground text-xs">to</span>
                        <Input
                          type="time"
                          placeholder="End"
                          value={session.endTime}
                          onChange={(e) => updateSession(session.id, { endTime: e.target.value })}
                          className="text-sm"
                        />
                      </div>
                      
                      {/* Venue */}
                      <div className="col-span-2 flex items-center gap-2">
                        <MapPin className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                        <Input
                          placeholder="Venue (optional)"
                          value={session.venueName}
                          onChange={(e) => updateSession(session.id, { venueName: e.target.value })}
                          className="text-sm"
                        />
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
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
              {proposedSessions.filter(s => s.date).length > 0 && (
                <p className="text-xs text-muted-foreground mt-1">
                  {proposedSessions.filter(s => s.date).length} proposed date(s)
                </p>
              )}
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
