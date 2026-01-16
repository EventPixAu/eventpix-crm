/**
 * TRAINING DATA UTILITIES
 * 
 * Provides hooks for creating and managing training/sample data.
 * All training data is marked with is_training=true for easy identification.
 * Admin-only access enforced.
 */
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { addDays, format } from 'date-fns';

// =============================================================
// TRAINING DATA QUERIES
// =============================================================

export function useTrainingClients() {
  return useQuery({
    queryKey: ['training-clients'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('clients')
        .select('*')
        .eq('is_training', true)
        .order('created_at', { ascending: false });
      
      if (error) throw error;
      return data;
    },
  });
}

export function useTrainingLeads() {
  return useQuery({
    queryKey: ['training-leads'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('leads')
        .select(`
          *,
          client:clients(business_name)
        `)
        .eq('is_training', true)
        .order('created_at', { ascending: false });
      
      if (error) throw error;
      return data;
    },
  });
}

export function useTrainingEvents() {
  return useQuery({
    queryKey: ['training-events'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('events')
        .select(`
          *,
          event_sessions(id),
          event_assignments(id)
        `)
        .eq('is_training', true)
        .order('created_at', { ascending: false });
      
      if (error) throw error;
      return data;
    },
  });
}

export function useTrainingProfiles() {
  return useQuery({
    queryKey: ['training-profiles'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('is_training', true)
        .order('created_at', { ascending: false });
      
      if (error) throw error;
      return data;
    },
  });
}

// =============================================================
// TRAINING DATA CREATION
// =============================================================

export function useCreateSampleClient() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async () => {
      const timestamp = Date.now().toString(36);
      
      const { data, error } = await supabase
        .from('clients')
        .insert({
          business_name: `[TRAINING] Sample Corp ${timestamp}`,
          primary_contact_name: 'Jane Training',
          primary_contact_email: `training.${timestamp}@example.com`,
          primary_contact_phone: '0400 000 000',
          billing_address: '123 Training Street, Sample City VIC 3000',
          notes: 'This is a training/sample client. Safe to delete.',
          is_training: true,
        })
        .select()
        .single();
      
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['clients'] });
      queryClient.invalidateQueries({ queryKey: ['training-clients'] });
      toast.success('Sample client created');
    },
    onError: (error: Error) => {
      toast.error(`Failed to create sample client: ${error.message}`);
    },
  });
}

export function useCreateSampleLeadWithQuote() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async () => {
      const timestamp = Date.now().toString(36);
      const eventDate = addDays(new Date(), 30);
      
      // 1. Create training client
      const { data: client, error: clientError } = await supabase
        .from('clients')
        .insert({
          business_name: `[TRAINING] Lead Client ${timestamp}`,
          primary_contact_name: 'Tom Training',
          primary_contact_email: `lead.training.${timestamp}@example.com`,
          primary_contact_phone: '0400 111 111',
          is_training: true,
        })
        .select()
        .single();
      
      if (clientError) throw clientError;

      // 2. Create lead
      const { data: user } = await supabase.auth.getUser();
      const { data: lead, error: leadError } = await supabase
        .from('leads')
        .insert({
          lead_name: `[TRAINING] Sample Lead ${timestamp}`,
          client_id: client.id,
          status: 'new',
          source: 'Training Generator',
          estimated_event_date: format(eventDate, 'yyyy-MM-dd'),
          notes: 'Training lead created by sample data generator.',
          is_training: true,
          created_by: user?.user?.id,
        })
        .select()
        .single();
      
      if (leadError) throw leadError;

      // 3. Create quote
      const { data: quote, error: quoteError } = await supabase
        .from('quotes')
        .insert({
          lead_id: lead.id,
          client_id: client.id,
          status: 'draft',
          terms_text: 'Sample terms for training quote. 50% deposit required.',
          notes: 'Training quote - safe to modify or delete.',
        })
        .select()
        .single();
      
      if (quoteError) throw quoteError;

      // 4. Add quote items
      const { error: itemsError } = await supabase
        .from('quote_items')
        .insert([
          {
            quote_id: quote.id,
            description: 'Corporate Event Coverage – Full Day',
            quantity: 1,
            unit_price: 2500,
            tax_rate: 0.1,
            sort_order: 1,
          },
          {
            quote_id: quote.id,
            description: 'Additional Photographer (Hourly)',
            quantity: 4,
            unit_price: 150,
            tax_rate: 0.1,
            sort_order: 2,
          },
        ]);
      
      if (itemsError) throw itemsError;

      return { client, lead, quote };
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['clients'] });
      queryClient.invalidateQueries({ queryKey: ['leads'] });
      queryClient.invalidateQueries({ queryKey: ['quotes'] });
      queryClient.invalidateQueries({ queryKey: ['training-clients'] });
      queryClient.invalidateQueries({ queryKey: ['training-leads'] });
      toast.success('Sample lead with quote created');
    },
    onError: (error: Error) => {
      toast.error(`Failed to create sample lead: ${error.message}`);
    },
  });
}

export function useCreateSampleEvent() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async () => {
      const timestamp = Date.now().toString(36);
      const eventDate = addDays(new Date(), 14);
      
      // 1. Create training client
      const { data: client, error: clientError } = await supabase
        .from('clients')
        .insert({
          business_name: `[TRAINING] Event Client ${timestamp}`,
          primary_contact_name: 'Sarah Sample',
          primary_contact_email: `event.training.${timestamp}@example.com`,
          is_training: true,
        })
        .select()
        .single();
      
      if (clientError) throw clientError;

      // Get event type
      const { data: eventTypes } = await supabase
        .from('event_types')
        .select('id')
        .eq('is_active', true)
        .limit(1);
      
      // Get delivery method
      const { data: deliveryMethods } = await supabase
        .from('delivery_methods_lookup')
        .select('id')
        .eq('is_active', true)
        .limit(1);

      // 2. Create event
      const { data: user } = await supabase.auth.getUser();
      const { data: event, error: eventError } = await supabase
        .from('events')
        .insert({
          event_name: `[TRAINING] Sample Event ${timestamp}`,
          client_id: client.id,
          client_name: client.business_name,
          event_date: format(eventDate, 'yyyy-MM-dd'),
          start_time: '09:00:00',
          end_time: '17:00:00',
          venue_name: 'Training Venue',
          venue_address: '456 Sample Road, Demo City VIC 3001',
          city: 'Melbourne',
          event_type_id: eventTypes?.[0]?.id || null,
          delivery_method_id: deliveryMethods?.[0]?.id || null,
          delivery_deadline: format(addDays(eventDate, 5), 'yyyy-MM-dd'),
          notes: 'Training event created by sample data generator. Safe to modify or delete.',
          ops_status: 'confirmed',
          is_training: true,
          created_by: user?.user?.id,
        })
        .select()
        .single();
      
      if (eventError) throw eventError;

      // 3. Create event sessions
      const { error: sessionError } = await supabase
        .from('event_sessions')
        .insert([
          {
            event_id: event.id,
            session_date: format(eventDate, 'yyyy-MM-dd'),
            start_time: '09:00:00',
            end_time: '12:00:00',
            label: 'Morning Session',
            venue_name: 'Main Hall',
          },
          {
            event_id: event.id,
            session_date: format(eventDate, 'yyyy-MM-dd'),
            start_time: '13:00:00',
            end_time: '17:00:00',
            label: 'Afternoon Session',
            venue_name: 'Main Hall',
          },
        ]);
      
      if (sessionError) throw sessionError;

      // 4. Create event contact
      const { error: contactError } = await supabase
        .from('event_contacts')
        .insert({
          event_id: event.id,
          contact_name: 'Training Contact',
          contact_email: 'contact@training.example.com',
          contact_phone: '0400 222 222',
          contact_type: 'onsite',
        });
      
      if (contactError) throw contactError;

      return { client, event };
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['events'] });
      queryClient.invalidateQueries({ queryKey: ['clients'] });
      queryClient.invalidateQueries({ queryKey: ['training-events'] });
      queryClient.invalidateQueries({ queryKey: ['training-clients'] });
      toast.success('Sample event with sessions created');
    },
    onError: (error: Error) => {
      toast.error(`Failed to create sample event: ${error.message}`);
    },
  });
}

export function useCreateSampleSeries() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async () => {
      const timestamp = Date.now().toString(36);
      const baseDate = addDays(new Date(), 21);
      
      // 1. Create training client
      const { data: client, error: clientError } = await supabase
        .from('clients')
        .insert({
          business_name: `[TRAINING] Series Client ${timestamp}`,
          primary_contact_name: 'Mike Series',
          primary_contact_email: `series.training.${timestamp}@example.com`,
          is_training: true,
        })
        .select()
        .single();
      
      if (clientError) throw clientError;

      // Get event type
      const { data: eventTypes } = await supabase
        .from('event_types')
        .select('id')
        .eq('is_active', true)
        .limit(1);
      
      // Get delivery method
      const { data: deliveryMethods } = await supabase
        .from('delivery_methods_lookup')
        .select('id')
        .eq('is_active', true)
        .limit(1);

      // 2. Create series
      const { data: series, error: seriesError } = await supabase
        .from('event_series')
        .insert({
          name: `[TRAINING] Sample Series ${timestamp}`,
          event_type_id: eventTypes?.[0]?.id || null,
          default_delivery_method_id: deliveryMethods?.[0]?.id || null,
          default_delivery_deadline_days: 5,
          default_coverage_details: 'Training series standard coverage',
          default_notes_public: 'Please arrive 15 minutes early.',
          default_notes_internal: 'Training series - use for testing workflows.',
          is_active: true,
        })
        .select()
        .single();
      
      if (seriesError) throw seriesError;

      // 3. Create 5 events in the series
      const { data: user } = await supabase.auth.getUser();
      const cities = ['Melbourne', 'Sydney', 'Brisbane', 'Perth', 'Adelaide'];
      const events = [];
      
      for (let i = 0; i < 5; i++) {
        const eventDate = addDays(baseDate, i * 7); // Weekly events
        
        const { data: event, error: eventError } = await supabase
          .from('events')
          .insert({
            event_name: `[TRAINING] ${cities[i]} Event`,
            event_series_id: series.id,
            client_id: client.id,
            client_name: client.business_name,
            event_date: format(eventDate, 'yyyy-MM-dd'),
            start_time: '18:00:00',
            end_time: '22:00:00',
            venue_name: `${cities[i]} Convention Centre`,
            venue_address: `1 Main Street, ${cities[i]}`,
            city: cities[i],
            event_type_id: eventTypes?.[0]?.id || null,
            delivery_method_id: deliveryMethods?.[0]?.id || null,
            delivery_deadline: format(addDays(eventDate, 5), 'yyyy-MM-dd'),
            ops_status: 'confirmed',
            is_training: true,
            created_by: user?.user?.id,
          })
          .select()
          .single();
        
        if (eventError) throw eventError;
        events.push(event);

        // Add session for each event
        await supabase
          .from('event_sessions')
          .insert({
            event_id: event.id,
            session_date: format(eventDate, 'yyyy-MM-dd'),
            start_time: '18:00:00',
            end_time: '22:00:00',
            label: 'Awards Ceremony',
            venue_name: 'Main Ballroom',
          });
      }

      return { client, series, events };
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['events'] });
      queryClient.invalidateQueries({ queryKey: ['clients'] });
      queryClient.invalidateQueries({ queryKey: ['event-series'] });
      queryClient.invalidateQueries({ queryKey: ['training-events'] });
      queryClient.invalidateQueries({ queryKey: ['training-clients'] });
      toast.success('Sample series with 5 events created');
    },
    onError: (error: Error) => {
      toast.error(`Failed to create sample series: ${error.message}`);
    },
  });
}

// =============================================================
// TRAINING DATA CLEANUP
// =============================================================

export function useDeleteTrainingData() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (type: 'clients' | 'leads' | 'events' | 'all') => {
      if (type === 'all' || type === 'events') {
        // Delete training events (cascades to sessions, assignments, etc.)
        const { error } = await supabase
          .from('events')
          .delete()
          .eq('is_training', true);
        if (error) throw error;
      }

      if (type === 'all' || type === 'leads') {
        // Delete training leads (cascades to quotes)
        const { error } = await supabase
          .from('leads')
          .delete()
          .eq('is_training', true);
        if (error) throw error;
      }

      if (type === 'all' || type === 'clients') {
        // Delete training clients
        const { error } = await supabase
          .from('clients')
          .delete()
          .eq('is_training', true);
        if (error) throw error;
      }

      return { deleted: type };
    },
    onSuccess: (_, type) => {
      queryClient.invalidateQueries({ queryKey: ['events'] });
      queryClient.invalidateQueries({ queryKey: ['leads'] });
      queryClient.invalidateQueries({ queryKey: ['clients'] });
      queryClient.invalidateQueries({ queryKey: ['quotes'] });
      queryClient.invalidateQueries({ queryKey: ['training-events'] });
      queryClient.invalidateQueries({ queryKey: ['training-leads'] });
      queryClient.invalidateQueries({ queryKey: ['training-clients'] });
      toast.success(`Training ${type === 'all' ? 'data' : type} deleted`);
    },
    onError: (error: Error) => {
      toast.error(`Failed to delete training data: ${error.message}`);
    },
  });
}
