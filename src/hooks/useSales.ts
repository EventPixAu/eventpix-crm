/**
 * SALES MODULE HOOKS
 * 
 * Provides data access for the Sales domain:
 * - Clients: Business entities
 * - Leads: Sales pipeline opportunities
 * - Quotes: Pricing proposals
 * 
 * Access restricted to: Admin, Sales roles (enforced via RLS)
 */
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import type { Database } from '@/integrations/supabase/types';

// Types
type Client = Database['public']['Tables']['clients']['Row'];
type ClientInsert = Database['public']['Tables']['clients']['Insert'];
type ClientUpdate = Database['public']['Tables']['clients']['Update'];

type Lead = Database['public']['Tables']['leads']['Row'];
type LeadInsert = Database['public']['Tables']['leads']['Insert'];
type LeadUpdate = Database['public']['Tables']['leads']['Update'];

type Quote = Database['public']['Tables']['quotes']['Row'];
type QuoteInsert = Database['public']['Tables']['quotes']['Insert'];
type QuoteUpdate = Database['public']['Tables']['quotes']['Update'];

// =============================================================
// CLIENT HOOKS
// =============================================================

export function useClients() {
  return useQuery({
    queryKey: ['clients'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('clients')
        .select('*')
        .order('business_name', { ascending: true });
      
      if (error) throw error;
      return data as Client[];
    },
  });
}

export function useClient(id: string | undefined) {
  return useQuery({
    queryKey: ['clients', id],
    queryFn: async () => {
      if (!id) return null;
      const { data, error } = await supabase
        .from('clients')
        .select(`
          *,
          category:company_categories(id, name),
          client_contacts (*),
          client_notes (*),
          client_communications (*)
        `)
        .eq('id', id)
        .single();
      
      if (error) throw error;
      return data;
    },
    enabled: !!id,
  });
}

export function useCreateClient() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (client: ClientInsert) => {
      const { data, error } = await supabase
        .from('clients')
        .insert(client)
        .select()
        .single();
      
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['clients'] });
      toast.success('Client created successfully');
    },
    onError: (error: Error) => {
      toast.error('Failed to create client', { description: error.message });
    },
  });
}

export function useUpdateClient() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, ...updates }: ClientUpdate & { id: string }) => {
      const { data, error } = await supabase
        .from('clients')
        .update(updates)
        .eq('id', id)
        .select()
        .single();
      
      if (error) throw error;
      return data;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['clients'] });
      queryClient.invalidateQueries({ queryKey: ['clients', variables.id] });
      toast.success('Client updated successfully');
    },
    onError: (error: Error) => {
      toast.error('Failed to update client', { description: error.message });
    },
  });
}

export function useDeleteClient() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('clients')
        .delete()
        .eq('id', id);
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['clients'] });
      toast.success('Client deleted successfully');
    },
    onError: (error: Error) => {
      toast.error('Failed to delete client', { description: error.message });
    },
  });
}

// =============================================================
// LEAD HOOKS
// =============================================================

export function useLeads() {
  return useQuery({
    queryKey: ['leads'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('leads')
        .select(`
          *,
          client:clients(id, business_name),
          event_type:event_types(id, name),
          lead_source:lead_sources(id, name),
          lost_reason:lost_reasons(id, name)
        `)
        .order('estimated_event_date', { ascending: true, nullsFirst: false });
      
      if (error) throw error;
      return data;
    },
  });
}

export function useClientLeads(clientId: string | undefined) {
  return useQuery({
    queryKey: ['leads', 'client', clientId],
    queryFn: async () => {
      if (!clientId) return [];
      const { data, error } = await supabase
        .from('leads')
        .select(`
          *,
          event_type:event_types(id, name),
          lead_source:lead_sources(id, name)
        `)
        .eq('client_id', clientId)
        .order('created_at', { ascending: false });
      
      if (error) throw error;
      return data;
    },
    enabled: !!clientId,
  });
}

export function useClientEvents(clientId: string | undefined) {
  return useQuery({
    queryKey: ['events', 'client', clientId],
    queryFn: async () => {
      if (!clientId) return [];
      const { data, error } = await supabase
        .from('events')
        .select(`
          *,
          event_type:event_types(id, name)
        `)
        .eq('client_id', clientId)
        .order('event_date', { ascending: false });
      
      if (error) throw error;
      return data;
    },
    enabled: !!clientId,
  });
}

export function useLead(id: string | undefined) {
  return useQuery({
    queryKey: ['leads', id],
    queryFn: async () => {
      if (!id) return null;
      const { data, error } = await supabase
        .from('leads')
        .select(`
          *,
          client:clients(*),
          event_type:event_types(id, name),
          lead_source:lead_sources(id, name),
          lost_reason:lost_reasons(id, name),
          quotes(*)
        `)
        .eq('id', id)
        .single();
      
      if (error) throw error;
      return data;
    },
    enabled: !!id,
  });
}

export function useCreateLead() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (lead: LeadInsert) => {
      const { data, error } = await supabase
        .from('leads')
        .insert(lead)
        .select()
        .single();
      
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['leads'] });
      toast.success('Lead created successfully');
    },
    onError: (error: Error) => {
      toast.error('Failed to create lead', { description: error.message });
    },
  });
}

export function useUpdateLead() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, ...updates }: LeadUpdate & { id: string }) => {
      const { data, error } = await supabase
        .from('leads')
        .update(updates)
        .eq('id', id)
        .select()
        .single();
      
      if (error) throw error;
      return data;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['leads'] });
      queryClient.invalidateQueries({ queryKey: ['leads', variables.id] });
      toast.success('Lead updated successfully');
    },
    onError: (error: Error) => {
      toast.error('Failed to update lead', { description: error.message });
    },
  });
}

// =============================================================
// QUOTE HOOKS
// =============================================================

export function useQuotes() {
  return useQuery({
    queryKey: ['quotes'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('quotes')
        .select(`
          *,
          lead:leads(id, lead_name, client:clients(id, business_name)),
          client:clients(id, business_name)
        `)
        .order('created_at', { ascending: false });
      
      if (error) throw error;
      return data;
    },
  });
}

export function useQuote(id: string | undefined) {
  return useQuery({
    queryKey: ['quotes', id],
    queryFn: async () => {
      if (!id) return null;
      const { data, error } = await supabase
        .from('quotes')
        .select(`
          *,
          lead:leads(
            *,
            client:clients(*),
            event_sessions:event_sessions(*)
          ),
          client:clients(*)
        `)
        .eq('id', id)
        .single();
      
      if (error) throw error;
      return data;
    },
    enabled: !!id,
  });
}

export function useCreateQuote() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (quote: QuoteInsert) => {
      const { data, error } = await supabase
        .from('quotes')
        .insert(quote)
        .select()
        .single();
      
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['quotes'] });
      toast.success('Quote created successfully');
    },
    onError: (error: Error) => {
      toast.error('Failed to create quote', { description: error.message });
    },
  });
}

export function useUpdateQuote() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, ...updates }: QuoteUpdate & { id: string }) => {
      const { data, error } = await supabase
        .from('quotes')
        .update(updates)
        .eq('id', id)
        .select()
        .single();
      
      if (error) throw error;
      return data;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['quotes'] });
      queryClient.invalidateQueries({ queryKey: ['quotes', variables.id] });
      toast.success('Quote updated successfully');
    },
    onError: (error: Error) => {
      toast.error('Failed to update quote', { description: error.message });
    },
  });
}

export function useDeleteQuote() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      // Delete quote items first, then the quote
      const { error: itemsError } = await supabase
        .from('quote_items')
        .delete()
        .eq('quote_id', id);
      if (itemsError) throw itemsError;

      const { error } = await supabase
        .from('quotes')
        .delete()
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['quotes'] });
      toast.success('Budget deleted');
    },
    onError: (error: Error) => {
      toast.error('Failed to delete budget', { description: error.message });
    },
  });
}

// =============================================================
// CONVERSION: Quote Accepted → Event Creation
// =============================================================

export function useConvertQuoteToEvent() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ 
      quoteId, 
      eventData 
    }: { 
      quoteId: string; 
      eventData: {
        event_name: string;
        event_date: string;
        event_type_id?: string;
        start_time?: string;
        end_time?: string;
        venue_name?: string;
        venue_address?: string;
        notes?: string;
      };
    }) => {
      // 1. Get the quote and lead details
      const { data: quote, error: quoteError } = await supabase
        .from('quotes')
        .select(`
          *,
          lead:leads(*),
          client:clients(*)
        `)
        .eq('id', quoteId)
        .single();
      
      if (quoteError) throw quoteError;
      if (!quote) throw new Error('Quote not found');
      if (quote.status === 'accepted') throw new Error('Quote already accepted');

      // 2. Create the event with links to client, lead, and quote
      const leadData = quote.lead as any;
      const clientData = quote.client as any;
      
      const { data: event, error: eventError } = await supabase
        .from('events')
        .insert({
          event_name: eventData.event_name,
          event_date: eventData.event_date,
          event_type_id: eventData.event_type_id || leadData?.event_type_id,
          start_time: eventData.start_time,
          end_time: eventData.end_time,
          venue_name: eventData.venue_name,
          venue_address: eventData.venue_address,
          notes: eventData.notes,
          client_id: quote.client_id || leadData?.client_id,
          client_name: clientData?.business_name || leadData?.client?.business_name || 'Unknown Client',
          lead_id: quote.lead_id,
          quote_id: quoteId,
          event_type: 'corporate', // Default, should be derived
          ops_status: 'confirmed',
        })
        .select()
        .single();
      
      if (eventError) throw eventError;

      // 3. Update quote: set status to accepted and link to created event
      const { error: updateQuoteError } = await supabase
        .from('quotes')
        .update({ 
          status: 'accepted',
          linked_event_id: event.id,
          updated_at: new Date().toISOString(),
        })
        .eq('id', quoteId);
      
      if (updateQuoteError) throw updateQuoteError;

      // 4. Update lead status to accepted (locks further edits)
      if (quote.lead_id) {
        const { error: updateLeadError } = await supabase
          .from('leads')
          .update({ 
            status: 'accepted',
            updated_at: new Date().toISOString(),
          })
          .eq('id', quote.lead_id);
        
        if (updateLeadError) throw updateLeadError;
      }

      return event;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['quotes'] });
      queryClient.invalidateQueries({ queryKey: ['leads'] });
      queryClient.invalidateQueries({ queryKey: ['events'] });
      toast.success('Quote converted to event', { description: 'The quote has been accepted and an event has been created.' });
    },
    onError: (error: Error) => {
      toast.error('Failed to convert quote', { description: error.message });
    },
  });
}
