import { useEffect, useMemo } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { ArrowLeft, Loader2 } from 'lucide-react';
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

const eventSchema = z.object({
  event_name: z.string().min(1, 'Event name is required'),
  event_type_id: z.string().min(1, 'Event type is required'),
  event_date: z.string().min(1, 'Date is required'),
  start_time: z.string().optional(),
  end_time: z.string().optional(),
  venue_name: z.string().optional(),
  venue_address: z.string().optional(),
  client_name: z.string().min(1, 'Client name is required'),
  onsite_contact_name: z.string().optional(),
  onsite_contact_phone: z.string().optional(),
  coverage_details: z.string().optional(),
  delivery_method_id: z.string().optional().nullable(),
  delivery_deadline: z.string().optional(),
  notes: z.string().optional(),
});

type EventFormValues = z.infer<typeof eventSchema>;

export default function EventForm() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const isEditing = !!id;

  const { data: event, isLoading } = useEvent(id);
  const { data: eventTypes = [], isLoading: typesLoading } = useEventTypes();
  const { data: deliveryMethods = [], isLoading: methodsLoading } = useDeliveryMethods();
  const createEvent = useCreateEvent();
  const updateEvent = useUpdateEvent();

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
      client_name: '',
      onsite_contact_name: '',
      onsite_contact_phone: '',
      coverage_details: '',
      delivery_method_id: null,
      delivery_deadline: '',
      notes: '',
    },
  });

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
        client_name: event.client_name,
        onsite_contact_name: event.onsite_contact_name || '',
        onsite_contact_phone: event.onsite_contact_phone || '',
        coverage_details: event.coverage_details || '',
        delivery_method_id: deliveryMethodId,
        delivery_deadline: event.delivery_deadline || '',
        notes: event.notes || '',
      });
    }
  }, [event, eventTypes, deliveryMethods, form, eventTypeNameToId, deliveryMethodNameToId]);

  const onSubmit = async (values: EventFormValues) => {
    const cleanValues = {
      event_name: values.event_name,
      event_type_id: values.event_type_id,
      event_date: values.event_date,
      client_name: values.client_name,
      start_time: values.start_time || null,
      end_time: values.end_time || null,
      venue_name: values.venue_name || null,
      venue_address: values.venue_address || null,
      onsite_contact_name: values.onsite_contact_name || null,
      onsite_contact_phone: values.onsite_contact_phone || null,
      coverage_details: values.coverage_details || null,
      delivery_method_id: values.delivery_method_id || null,
      delivery_deadline: values.delivery_deadline || null,
      notes: values.notes || null,
    };

    if (isEditing && id) {
      await updateEvent.mutateAsync({ id, ...cleanValues });
      navigate(`/events/${id}`);
    } else {
      const result = await createEvent.mutateAsync(cleanValues);
      navigate(`/events/${result.id}`);
    }
  };

  if (isEditing && (isLoading || typesLoading || methodsLoading)) {
    return (
      <AppLayout>
        <div className="flex items-center justify-center h-64">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <div className="max-w-2xl">
        <Link
          to={isEditing ? `/events/${id}` : '/events'}
          className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground mb-4"
        >
          <ArrowLeft className="h-4 w-4" />
          Back
        </Link>

        <PageHeader
          title={isEditing ? 'Edit Event' : 'New Event'}
          description={isEditing ? 'Update event details' : 'Create a new event'}
        />

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
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
                      <FormLabel>Date</FormLabel>
                      <FormControl>
                        <Input {...field} type="date" className="bg-secondary" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <div className="grid sm:grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="start_time"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Start Time</FormLabel>
                      <FormControl>
                        <Input {...field} type="time" className="bg-secondary" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="end_time"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>End Time</FormLabel>
                      <FormControl>
                        <Input {...field} type="time" className="bg-secondary" />
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
                      <Input {...field} placeholder="Full address" className="bg-secondary" />
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
                      <Input {...field} placeholder="Client's name" className="bg-secondary" />
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
                      <FormControl>
                        <Input {...field} placeholder="Contact name" className="bg-secondary" />
                      </FormControl>
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

            <div className="flex gap-3">
              <Button
                type="submit"
                className="bg-gradient-primary hover:opacity-90"
                disabled={createEvent.isPending || updateEvent.isPending}
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
