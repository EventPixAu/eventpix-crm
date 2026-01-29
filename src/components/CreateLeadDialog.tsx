/**
 * CREATE LEAD DIALOG
 * 
 * Modal dialog for creating new leads with:
 * - Company selection (existing or new)
 * - Primary contact via CRM ContactSelector
 * - Event type and lead source
 * - Multiple proposed dates/times
 * 
 * Access: Admin, Sales roles only
 */
import { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { format } from 'date-fns';
import { Target, Plus, Building2, CalendarIcon, User, Clock, Trash2, MapPin, Check, ChevronsUpDown } from 'lucide-react';
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
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/components/ui/command';
import { Calendar } from '@/components/ui/calendar';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useClients, useCreateClient, useCreateLead } from '@/hooks/useSales';
import { useEventTypes } from '@/hooks/useLookups';
import { useLeadSources } from '@/hooks/useLeadSources';
import { useAuth } from '@/lib/auth';
import { cn } from '@/lib/utils';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { ContactSelector } from '@/components/shared/ContactSelector';
import { VenueSuggestInput } from '@/components/VenueSuggestInput';
import type { CrmContact } from '@/hooks/useContactSearch';

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
  const [companySearchOpen, setCompanySearchOpen] = useState(false);
  const [newCompanyName, setNewCompanyName] = useState('');
  
  // Get selected company name for display
  const selectedCompanyName = useMemo(() => {
    return clients.find(c => c.id === selectedClientId)?.business_name || '';
  }, [clients, selectedClientId]);
  
  // Form state - Primary Contact (now uses CRM contact_id)
  const [primaryContactId, setPrimaryContactId] = useState<string | null>(null);
  const [primaryContact, setPrimaryContact] = useState<CrmContact | null>(null);
  
  // Form state - Lead Details
  const [eventName, setEventName] = useState('');
  const [eventTypeId, setEventTypeId] = useState('');
  const [leadSourceId, setLeadSourceId] = useState('');
  const [venueText, setVenueText] = useState('');
  const [notes, setNotes] = useState('');
  
  // Form state - Proposed Sessions (multiple dates/times)
  const [proposedSessions, setProposedSessions] = useState<ProposedSession[]>([]);
  
  // Reset form when dialog opens/closes
  useEffect(() => {
    if (open) {
      setSelectedClientId(defaultClientId || '');
      setCompanyTab(defaultClientId ? 'existing' : 'existing');
      setNewCompanyName('');
      setPrimaryContactId(null);
      setPrimaryContact(null);
      setEventName('');
      setEventTypeId('');
      setLeadSourceId('');
      setVenueText('');
      setNotes('');
      setProposedSessions([]);
    }
  }, [open, defaultClientId]);
  
  // Handle contact selection
  const handleContactChange = (contactId: string | null, contact?: CrmContact | null) => {
    setPrimaryContactId(contactId);
    setPrimaryContact(contact || null);
  };
  
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
  
  const isContactValid = !!primaryContactId;
  
  const isFormValid = isCompanyValid && isContactValid && eventName.trim().length > 0;
  
  const isSubmitting = createClient.isPending || createLead.isPending;
  
  // Get estimated event date from first session or undefined
  const getEstimatedDate = () => {
    const firstSessionWithDate = proposedSessions.find(s => s.date);
    return firstSessionWithDate?.date;
  };
  
  // Submit handler
  const handleSubmit = async () => {
    if (!isFormValid || !primaryContactId) return;
    
    try {
      let clientId = selectedClientId;
      
      // Create new company if needed
      if (companyTab === 'new') {
        const newClient = await createClient.mutateAsync({
          business_name: newCompanyName.trim(),
          primary_contact_name: primaryContact?.contact_name || null,
          primary_contact_email: primaryContact?.email || null,
          primary_contact_phone: primaryContact?.phone_mobile || primaryContact?.phone || null,
        });
        clientId = newClient.id;
        
        // Link the contact to the new company if not already linked
        if (primaryContactId && !primaryContact?.client_id) {
          await supabase
            .from('contact_company_associations')
            .insert({
              contact_id: primaryContactId,
              company_id: newClient.id,
              is_primary: true,
              is_active: true,
            });
        }
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
        venue_text: venueText.trim() || null,
        notes: notes.trim() || null,
        status: 'new',
      });
      
      // Create enquiry contact linking to the CRM contact
      const { error: contactError } = await supabase
        .from('enquiry_contacts')
        .insert({
          lead_id: newLead.id,
          contact_id: primaryContactId, // Store contact_id reference
          contact_name: primaryContact?.contact_name || null,
          contact_email: primaryContact?.email || null,
          contact_phone: primaryContact?.phone_mobile || primaryContact?.phone || null,
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
                <Popover open={companySearchOpen} onOpenChange={setCompanySearchOpen}>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      role="combobox"
                      aria-expanded={companySearchOpen}
                      className="w-full justify-between font-normal"
                    >
                      {selectedClientId ? selectedCompanyName : "Select a company..."}
                      <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-[--radix-popover-trigger-width] p-0" align="start">
                    <Command filter={(value, search) => {
                      if (value.toLowerCase().includes(search.toLowerCase())) return 1;
                      return 0;
                    }}>
                      <CommandInput placeholder="Search companies..." />
                      <CommandList>
                        <CommandEmpty>No company found.</CommandEmpty>
                        <CommandGroup>
                          {clients.map((client) => (
                            <CommandItem
                              key={client.id}
                              value={client.business_name}
                              onSelect={() => {
                                setSelectedClientId(client.id);
                                setCompanySearchOpen(false);
                              }}
                            >
                              <Check
                                className={cn(
                                  "mr-2 h-4 w-4",
                                  selectedClientId === client.id ? "opacity-100" : "opacity-0"
                                )}
                              />
                              {client.business_name}
                            </CommandItem>
                          ))}
                        </CommandGroup>
                      </CommandList>
                    </Command>
                  </PopoverContent>
                </Popover>
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
          
          {/* Primary Contact - Now uses ContactSelector */}
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <User className="h-4 w-4 text-muted-foreground" />
              <Label className="text-sm font-medium">Primary Contact *</Label>
            </div>
            <ContactSelector
              value={primaryContactId}
              onChange={handleContactChange}
              companyId={companyTab === 'existing' ? selectedClientId : undefined}
              placeholder="Search CRM contacts or create new..."
            />
            <p className="text-xs text-muted-foreground">
              Search existing contacts or create a new one. Contacts are stored in CRM for reuse.
            </p>
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
            <VenueSuggestInput
              value={venueText}
              onChange={setVenueText}
              showIcon
              placeholder="Venue name or address"
            />
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
                      <div className="col-span-2">
                        <VenueSuggestInput
                          value={session.venueName}
                          onChange={(val) => updateSession(session.id, { venueName: val })}
                          placeholder="Venue (optional)"
                          showIcon
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
