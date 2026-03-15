import { useEffect, useMemo, useState } from 'react';
import { useParams, useNavigate, Link, useSearchParams } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { ArrowLeft, Loader2, MapPin } from 'lucide-react';
import { AppLayout } from '@/components/layout/AppLayout';
import { PageHeader } from '@/components/layout/PageHeader';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useEvent, useCreateEvent, useUpdateEvent } from '@/hooks/useEvents';
import { useEventTypes, useDeliveryMethods } from '@/hooks/useLookups';
import { EventLockBanner } from '@/components/EventLockBanner';
import { GuardrailOverrideDialog } from '@/components/GuardrailOverrideDialog';
import { useEventLocking } from '@/hooks/useGuardrails';
import { useAuth } from '@/lib/auth';
import { EventSessionsEditor } from '@/components/EventSessionsEditor';
import { EventContactsEditor } from '@/components/EventContactsEditor';
import { EventClientLookup } from '@/components/EventClientLookup';
import { useLead } from '@/hooks/useSales';
import { useLeadSessions } from '@/hooks/useEventSessions';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { useClientByBusinessName } from '@/hooks/useClientByBusinessName';
import { useClientContacts, getBestPhone } from '@/hooks/useClientContacts';

const eventSchema = z.object({
  event_name: z.string().min(1, 'Event name is required'),
  event_type_id: z.string().min(1, 'Event type is required'),
  event_date: z.string().min(1, 'Date is required'),
  start_time: z.string().optional(),
  end_time: z.string().optional(),
  venue_name: z.string().optional(),
  venue_address: z.string().optional(),
  venue_access_notes: z.string().optional(),
  venue_parking_notes: z.string().optional(),
  client_name: z.string().min(1, 'Client name is required'),
  onsite_contact_name: z.string().optional(),
  onsite_contact_phone: z.string().optional(),
  coverage_details: z.string().optional(),
  photography_instructions: z.string().optional(),
  delivery_method_id: z.string().optional().nullable(),
  delivery_method_guests_id: z.string().optional().nullable(),
  delivery_deadline: z.string().optional(),
  notes: z.string().optional(),
});

type EventFormValues = z.infer<typeof eventSchema>;

export default function EventForm() {
  const { id } = useParams<{ id: string }>();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const isEditing = !!id;
  
  // Check if converting from a lead
  const leadIdFromQuery = searchParams.get('fromLead');
  const isConvertingFromLead = !!leadIdFromQuery && !isEditing;

  const { data: event, isLoading } = useEvent(id);
  const { data: eventTypes = [], isLoading: typesLoading } = useEventTypes();
  const { data: deliveryMethods = [], isLoading: methodsLoading } = useDeliveryMethods();
  
  // Fetch lead data if converting
  const { data: sourceLead, isLoading: leadLoading } = useLead(leadIdFromQuery || undefined);
  const { data: leadSessions = [] } = useLeadSessions(leadIdFromQuery || undefined);
  
  const createEvent = useCreateEvent();
  const updateEvent = useUpdateEvent();
  
  // Event locking state
  const { isLocked, minutesUntilStart } = useEventLocking(event?.start_at || null);
  const [showOverrideDialog, setShowOverrideDialog] = useState(false);
  const [isUnlocked, setIsUnlocked] = useState(false);
  const [selectedClientId, setSelectedClientId] = useState<string | null>(null);
  
  // Determine if form should be disabled due to lock
  const isFormLocked = isEditing && isLocked && !isUnlocked;

  // Create lookup map for finding type ID from legacy enum
  const eventTypeNameToId = useMemo(() => {
    return eventTypes.reduce((acc, et) => {
      acc[et.name.toLowerCase()] = et.id;
      return acc;
    }, {} as Record<string, string>);
  }, [eventTypes]);

  const deliveryMethodNameToId = useMemo(() => {
    return deliveryMethods.reduce((acc, dm) => {
      acc[dm.name.toLowerCase().replace(/ /g, '_')] = dm.id;
      return acc;
    }, {} as Record<string, string>);
  }, [deliveryMethods]);

  const form = useForm<EventFormValues>({
    resolver: zodResolver(eventSchema),
    defaultValues: {
      event_name: '',
      event_type_id: '',
      event_date: '',
      start_time: '',
      end_time: '',
      venue_name: '',
      venue_address: '',
      venue_access_notes: '',
      venue_parking_notes: '',
      client_name: '',
      onsite_contact_name: '',
      onsite_contact_phone: '',
      coverage_details: '',
      photography_instructions: '',
      delivery_method_id: null,
      delivery_method_guests_id: null,
      delivery_deadline: '',
      notes: '',
    },
  });

  // Watch client and on-site contact fields to lookup linked records
  const clientNameValue = form.watch('client_name');
  const onsiteContactNameValue = form.watch('onsite_contact_name');
  const onsiteContactPhoneValue = form.watch('onsite_contact_phone');
  
  // Resolve client ID from business name
  const { data: resolvedClient } = useClientByBusinessName(clientNameValue);
  
  // Determine effective client ID from explicit selection or exact-name fallback
  const effectiveClientId = selectedClientId ?? resolvedClient?.id ?? null;
  
  // Fetch contacts for the client
  const { data: clientContacts = [] } = useClientContacts(effectiveClientId);

  const resetOnsiteContact = () => {
    form.setValue('onsite_contact_name', '');
    form.setValue('onsite_contact_phone', '');
  };

  const handleClientNameChange = (clientName: string) => {
    const previousName = form.getValues('client_name');
    form.setValue('client_name', clientName, { shouldDirty: true, shouldValidate: true });

    if (clientName !== previousName) {
      setSelectedClientId(null);
      resetOnsiteContact();
    }
  };

  const handleContactSelect = (contactId: string) => {
    const selectedContact = clientContacts.find(c => c.id === contactId);
    if (selectedContact) {
      form.setValue('onsite_contact_name', selectedContact.contact_name, { shouldDirty: true, shouldValidate: true });
      form.setValue('onsite_contact_phone', getBestPhone(selectedContact), { shouldDirty: true, shouldValidate: true });
    } else if (contactId === '__manual__') {
      resetOnsiteContact();
    }
  };

  useEffect(() => {
    if (!onsiteContactNameValue || onsiteContactPhoneValue) return;

    const matchedContact = clientContacts.find(
      (contact) => contact.contact_name === onsiteContactNameValue
    );

    if (!matchedContact) return;

    const matchedPhone = getBestPhone(matchedContact);
    if (!matchedPhone) return;

    form.setValue('onsite_contact_phone', matchedPhone, {
      shouldDirty: true,
      shouldValidate: true,
    });
  }, [clientContacts, form, onsiteContactNameValue, onsiteContactPhoneValue]);

  // Pre-populate from existing event (editing mode)
  useEffect(() => {
    if (event && eventTypes.length > 0) {
      // Get event_type_id - either from new FK or find from legacy enum
      let eventTypeId = event.event_type_id || '';
      if (!eventTypeId && event.event_type) {
        eventTypeId = eventTypeNameToId[event.event_type.toLowerCase()] || '';
      }

      // Get delivery_method_id - either from new FK or find from legacy enum
      let deliveryMethodId = event.delivery_method_id || null;
      if (!deliveryMethodId && event.delivery_method) {
        deliveryMethodId = deliveryMethodNameToId[event.delivery_method.toLowerCase()] || null;
      }

      form.reset({
        event_name: event.event_name,
        event_type_id: eventTypeId,
        event_date: event.event_date,
        start_time: event.start_time || '',
        end_time: event.end_time || '',
        venue_name: event.venue_name || '',
        venue_address: event.venue_address || '',
        venue_access_notes: (event as any).venue_access_notes || '',
        venue_parking_notes: (event as any).venue_parking_notes || '',
        client_name: event.client_name,
        onsite_contact_name: event.onsite_contact_name || '',
        onsite_contact_phone: event.onsite_contact_phone || '',
        coverage_details: event.coverage_details || '',
        photography_instructions: (event as any).photography_brief || '',
        delivery_method_id: deliveryMethodId,
        delivery_method_guests_id: (event as any).delivery_method_guests_id || null,
        delivery_deadline: event.delivery_deadline || '',
        notes: event.notes || '',
      });
      setSelectedClientId(event.client_id || null);
    }
  }, [event, eventTypes, deliveryMethods, form, eventTypeNameToId, deliveryMethodNameToId]);

  // Pre-populate from lead (conversion mode)
  useEffect(() => {
    if (isConvertingFromLead && sourceLead && eventTypes.length > 0 && !isEditing) {
      const client = (sourceLead as any).client;
      const firstSession = leadSessions[0];
      
      // Calculate delivery deadline (5 days after event)
      let deliveryDeadline = '';
      const eventDate = firstSession?.session_date || sourceLead.estimated_event_date;
      if (eventDate) {
        const deadline = new Date(eventDate);
        deadline.setDate(deadline.getDate() + 5);
        deliveryDeadline = deadline.toISOString().split('T')[0];
      }
      
      form.reset({
        event_name: sourceLead.lead_name || '',
        event_type_id: (sourceLead as any).event_type_id || '',
        event_date: eventDate || '',
        start_time: firstSession?.start_time || '',
        end_time: firstSession?.end_time || '',
        venue_name: (sourceLead as any).venue_text || '',
        venue_address: '',
        venue_access_notes: '',
        venue_parking_notes: '',
        client_name: client?.business_name || '',
        onsite_contact_name: '',
        onsite_contact_phone: '',
        coverage_details: (sourceLead as any).requirements_summary || '',
        photography_instructions: '',
        delivery_method_id: null,
        delivery_deadline: deliveryDeadline,
        notes: sourceLead.notes || '',
      });
      setSelectedClientId((sourceLead as any).client_id || null);
    }
  }, [isConvertingFromLead, sourceLead, leadSessions, eventTypes, form, isEditing]);

  const handleRequestUnlock = () => {
    setShowOverrideDialog(true);
  };
  
  const handleOverrideConfirmed = () => {
    setIsUnlocked(true);
  };

  const onSubmit = async (values: EventFormValues) => {
    const cleanValues: any = {
      event_name: values.event_name,
      event_type_id: values.event_type_id,
      event_date: values.event_date,
      client_name: values.client_name,
      client_id: effectiveClientId,
      start_time: values.start_time || null,
      end_time: values.end_time || null,
      venue_name: values.venue_name || null,
      venue_address: values.venue_address || null,
      venue_access_notes: values.venue_access_notes || null,
      venue_parking_notes: values.venue_parking_notes || null,
      onsite_contact_name: values.onsite_contact_name || null,
      onsite_contact_phone: values.onsite_contact_phone || null,
      coverage_details: values.coverage_details || null,
      photography_brief: values.photography_instructions || null,
      delivery_method_id: values.delivery_method_id || null,
      delivery_method_guests_id: values.delivery_method_guests_id || null,
      delivery_deadline: values.delivery_deadline || null,
      notes: values.notes || null,
    };
    
    // If converting from lead, add lead_id and client_id
    if (isConvertingFromLead && sourceLead) {
      cleanValues.lead_id = leadIdFromQuery;
      cleanValues.client_id = (sourceLead as any).client_id;
    }

    if (isEditing && id) {
      await updateEvent.mutateAsync({ id, ...cleanValues });
      navigate(`/events/${id}`);
    } else {
      const result = await createEvent.mutateAsync(cleanValues);
      navigate(`/events/${result.id}`);
    }
  };

  // Loading state for editing or lead conversion
  if ((isEditing && (isLoading || typesLoading || methodsLoading)) || 
      (isConvertingFromLead && (leadLoading || typesLoading))) {
    return (
      <AppLayout>
        <div className="flex items-center justify-center h-64">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      </AppLayout>
    );
  }

  // Determine back link and page title
  const backLink = isConvertingFromLead 
    ? `/sales/leads/${leadIdFromQuery}` 
    : isEditing 
      ? `/events/${id}` 
      : '/events';
  
  const pageTitle = isConvertingFromLead 
    ? 'Convert Lead to Job' 
    : isEditing 
      ? 'Edit Event' 
      : 'New Event';

  return (
    <AppLayout>
      <div className="max-w-2xl">
        <Link
          to={backLink}
          className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground mb-4"
        >
          <ArrowLeft className="h-4 w-4" />
          Back
        </Link>

        <PageHeader
          title={pageTitle}
          description={isConvertingFromLead 
            ? `Creating job from lead: ${sourceLead?.lead_name}` 
            : isEditing 
              ? 'Update event details' 
              : 'Create a new event'}
        />

        {/* Lead conversion info banner */}
        {isConvertingFromLead && sourceLead && (
          <Alert className="mb-6">
            <AlertDescription>
              This job will be linked to the lead <strong>"{sourceLead.lead_name}"</strong>
              {(sourceLead as any).client?.business_name && (
                <> for client <strong>{(sourceLead as any).client.business_name}</strong></>
              )}. Sessions and contacts from the lead will be transferred after creation.
            </AlertDescription>
          </Alert>
        )}
        {/* Event Lock Banner */}
        {isEditing && isLocked && !isUnlocked && (
          <div className="mb-6">
            <EventLockBanner 
              eventStartAt={event?.start_at || null}
              onRequestUnlock={handleRequestUnlock}
              showUnlockButton={true}
            />
          </div>
        )}

        {/* Override Dialog */}
        <GuardrailOverrideDialog
          open={showOverrideDialog}
          onOpenChange={setShowOverrideDialog}
          hardBlocks={[{
            type: 'hard_block',
            rule: 'event_locked',
            message: `Event starts in ${minutesUntilStart} minutes`,
            details: 'Editing is locked close to event start time to prevent accidental changes.',
          }]}
          softBlocks={[]}
          eventId={id || ''}
          userId={user?.id || ''}
          onOverrideConfirmed={handleOverrideConfirmed}
          overrideType="event_unlock"
        />

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
            <fieldset disabled={isFormLocked} className="space-y-6">
            <div className="bg-card border border-border rounded-xl p-5 space-y-4">
              <h3 className="font-display font-semibold">Basic Information</h3>

              <FormField
                control={form.control}
                name="event_name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Event Name</FormLabel>
                    <FormControl>
                      <Input {...field} placeholder="e.g., Smith Wedding" className="bg-secondary" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <div className="grid sm:grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="event_type_id"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Event Type</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value}>
                        <FormControl>
                          <SelectTrigger className="bg-secondary">
                            <SelectValue placeholder="Select type" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {eventTypes.map((type) => (
                            <SelectItem key={type.id} value={type.id}>
                              {type.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="event_date"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Start Date</FormLabel>
                      <FormControl>
                        <Input {...field} type="date" className="bg-secondary" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
            </div>

            <div className="bg-card border border-border rounded-xl p-5 space-y-4">
              <h3 className="font-display font-semibold">Venue</h3>

              <FormField
                control={form.control}
                name="venue_name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Venue Name</FormLabel>
                    <FormControl>
                      <Input {...field} placeholder="e.g., Grand Ballroom" className="bg-secondary" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="venue_address"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Address</FormLabel>
                    <FormControl>
                      <div className="flex gap-2">
                        <Input {...field} placeholder="Full address (links to Google Maps)" className="bg-secondary flex-1" />
                        {field.value && (
                          <Button
                            type="button"
                            variant="outline"
                            size="icon"
                            onClick={() => window.open(`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(field.value)}`, '_blank')}
                            title="Open in Google Maps"
                          >
                            <MapPin className="h-4 w-4" />
                          </Button>
                        )}
                      </div>
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="venue_access_notes"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Access Notes</FormLabel>
                    <FormControl>
                      <Textarea {...field} placeholder="e.g., Enter via loading dock, use staff elevator..." className="bg-secondary min-h-[60px]" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="venue_parking_notes"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Parking Notes</FormLabel>
                    <FormControl>
                      <Textarea {...field} placeholder="e.g., Street parking available, paid parking at 123 Main St..." className="bg-secondary min-h-[60px]" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <div className="bg-card border border-border rounded-xl p-5 space-y-4">
              <h3 className="font-display font-semibold">Contact</h3>

              <FormField
                control={form.control}
                name="client_name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Client Name</FormLabel>
                    <FormControl>
                      <EventClientLookup
                        value={field.value}
                        onValueChange={handleClientNameChange}
                        onCompanySelect={(company) => {
                          form.setValue('client_name', company.business_name, { shouldDirty: true, shouldValidate: true });
                          setSelectedClientId(company.id);
                          resetOnsiteContact();
                        }}
                        onContactSelect={({ contactName, phone, companyId, companyName }) => {
                          form.setValue('client_name', companyName || contactName, { shouldDirty: true, shouldValidate: true });
                          form.setValue('onsite_contact_name', contactName, { shouldDirty: true, shouldValidate: true });
                          form.setValue('onsite_contact_phone', phone, { shouldDirty: true, shouldValidate: true });
                          setSelectedClientId(companyId);
                        }}
                        placeholder="Search existing client or contact"
                        disabled={isFormLocked}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <div className="grid sm:grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="onsite_contact_name"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>On-site Contact</FormLabel>
                      {clientContacts.length > 0 ? (
                        <Select 
                          onValueChange={(value) => {
                            if (value === '__manual__') {
                              field.onChange('');
                              form.setValue('onsite_contact_phone', '');
                            } else {
                              handleContactSelect(value);
                            }
                          }}
                          value={clientContacts.find(c => c.contact_name === field.value)?.id || '__manual__'}
                        >
                          <FormControl>
                            <SelectTrigger className="bg-secondary">
                              <SelectValue placeholder="Select contact" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            {clientContacts.map((contact) => (
                              <SelectItem key={contact.id} value={contact.id}>
                                {contact.contact_name}
                                {getBestPhone(contact) && (
                                  <span className="text-muted-foreground ml-2">
                                    ({getBestPhone(contact)})
                                  </span>
                                )}
                              </SelectItem>
                            ))}
                            <SelectItem value="__manual__">
                              <span className="text-muted-foreground">Enter manually...</span>
                            </SelectItem>
                          </SelectContent>
                        </Select>
                      ) : (
                        <FormControl>
                          <Input {...field} placeholder="Contact name" className="bg-secondary" />
                        </FormControl>
                      )}
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="onsite_contact_phone"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Phone</FormLabel>
                      <FormControl>
                        <Input {...field} type="tel" placeholder="Phone number" className="bg-secondary" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
            </div>

            <div className="bg-card border border-border rounded-xl p-5 space-y-4">
              <h3 className="font-display font-semibold">Delivery</h3>

              <div className="grid sm:grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="delivery_method_id"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Delivery Method</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value || undefined}>
                        <FormControl>
                          <SelectTrigger className="bg-secondary">
                            <SelectValue placeholder="Select method" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {deliveryMethods.map((method) => (
                            <SelectItem key={method.id} value={method.id}>
                              {method.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="delivery_deadline"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Delivery Deadline</FormLabel>
                      <FormControl>
                        <Input {...field} type="date" className="bg-secondary" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
            </div>

            {/* Sessions Section - only show when editing */}
            {isEditing && id && (
              <div className="bg-card border border-border rounded-xl p-5">
                <EventSessionsEditor eventId={id} disabled={isFormLocked} />
              </div>
            )}

            {/* Event Contacts Section - only show when editing */}
            {isEditing && id && (
              <div className="bg-card border border-border rounded-xl p-5">
                <EventContactsEditor 
                  eventId={id} 
                  clientId={event?.client_id} 
                  disabled={isFormLocked} 
                />
              </div>
            )}

            <div className="bg-card border border-border rounded-xl p-5 space-y-4">
              <h3 className="font-display font-semibold">Additional Details</h3>

              <FormField
                control={form.control}
                name="coverage_details"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Coverage Details</FormLabel>
                    <FormControl>
                      <Textarea
                        {...field}
                        placeholder="Shot list, special requests, etc."
                        className="bg-secondary min-h-24"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="photography_instructions"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Photography Instructions</FormLabel>
                    <FormControl>
                      <Textarea
                        {...field}
                        placeholder="Camera settings, lighting setup, specific techniques..."
                        className="bg-secondary min-h-24"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="notes"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Notes</FormLabel>
                    <FormControl>
                      <Textarea
                        {...field}
                        placeholder="Additional notes..."
                        className="bg-secondary min-h-24"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>
            </fieldset>

            <div className="flex gap-3">
              <Button
                type="submit"
                className="bg-gradient-primary hover:opacity-90"
                disabled={createEvent.isPending || updateEvent.isPending || isFormLocked}
              >
                {(createEvent.isPending || updateEvent.isPending) && (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                )}
                {isEditing ? 'Update Event' : 'Create Event'}
              </Button>
              <Link to={isEditing ? `/events/${id}` : '/events'}>
                <Button type="button" variant="outline">
                  Cancel
                </Button>
              </Link>
            </div>
          </form>
        </Form>
      </div>
    </AppLayout>
  );
}
