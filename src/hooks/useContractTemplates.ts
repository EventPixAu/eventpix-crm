/**
 * CONTRACT TEMPLATES HOOKS
 * 
 * Provides data access for Contract Templates.
 * Access: Admin can CRUD, Sales can read (enforced via RLS)
 */
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { format } from 'date-fns';

export interface ContractTemplate {
  id: string;
  name: string;
  body_html: string;
  body_text: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface ContractTemplateInsert {
  name: string;
  body_html: string;
  body_text?: string | null;
  is_active?: boolean;
}

export interface ContractTemplateUpdate extends Partial<ContractTemplateInsert> {
  id: string;
}

// Merge field context for rendering templates
export interface MergeFieldContext {
  client?: {
    business_name?: string | null;
    primary_contact_name?: string | null;
  };
  event?: {
    venue_name?: string | null;
    venue_address?: string | null;
  };
  sessions?: Array<{
    session_date: string;
    start_time?: string | null;
    end_time?: string | null;
  }>;
  quote?: {
    quote_number?: string | null;
    total_estimate?: number | null;
  };
}

// Format sessions for merge field
function formatSessions(sessions: MergeFieldContext['sessions']): string {
  if (!sessions || sessions.length === 0) return 'TBD';
  
  return sessions.map(session => {
    const date = format(new Date(session.session_date), 'd MMM yyyy');
    const start = session.start_time ? session.start_time.slice(0, 5) : '';
    const end = session.end_time ? session.end_time.slice(0, 5) : '';
    
    if (start && end) {
      return `${date} ${start}–${end}`;
    } else if (start) {
      return `${date} ${start}`;
    }
    return date;
  }).join(', ');
}

// Format currency
function formatCurrency(value: number | null | undefined): string {
  if (value == null) return '$0.00';
  return new Intl.NumberFormat('en-AU', { 
    style: 'currency', 
    currency: 'AUD' 
  }).format(value);
}

// Render merge fields in template HTML
export function renderMergeFields(html: string, context: MergeFieldContext): string {
  let rendered = html;
  
  // Client fields
  rendered = rendered.replace(/\{\{client\.business_name\}\}/g, context.client?.business_name || '');
  rendered = rendered.replace(/\{\{client\.primary_contact_name\}\}/g, context.client?.primary_contact_name || '');
  
  // Event fields
  rendered = rendered.replace(/\{\{event\.venue_name\}\}/g, context.event?.venue_name || '');
  rendered = rendered.replace(/\{\{event\.venue_address\}\}/g, context.event?.venue_address || '');
  
  // Sessions field
  rendered = rendered.replace(/\{\{event\.sessions\}\}/g, formatSessions(context.sessions));
  
  // Quote fields
  rendered = rendered.replace(/\{\{quote\.quote_number\}\}/g, context.quote?.quote_number || '');
  rendered = rendered.replace(/\{\{quote\.total_estimate\}\}/g, formatCurrency(context.quote?.total_estimate));
  
  return rendered;
}

// =============================================================
// QUERY HOOKS
// =============================================================

export function useContractTemplates() {
  return useQuery({
    queryKey: ['contract-templates'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('contract_templates')
        .select('*')
        .order('name', { ascending: true });
      
      if (error) throw error;
      return data as ContractTemplate[];
    },
  });
}

export function useActiveContractTemplates() {
  return useQuery({
    queryKey: ['contract-templates', 'active'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('contract_templates')
        .select('*')
        .eq('is_active', true)
        .order('name', { ascending: true });
      
      if (error) throw error;
      return data as ContractTemplate[];
    },
  });
}

export function useContractTemplate(id: string | undefined) {
  return useQuery({
    queryKey: ['contract-templates', id],
    queryFn: async () => {
      if (!id) return null;
      const { data, error } = await supabase
        .from('contract_templates')
        .select('*')
        .eq('id', id)
        .single();
      
      if (error) throw error;
      return data as ContractTemplate;
    },
    enabled: !!id,
  });
}

// =============================================================
// MUTATION HOOKS
// =============================================================

export function useCreateContractTemplate() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (template: ContractTemplateInsert) => {
      const { data, error } = await supabase
        .from('contract_templates')
        .insert(template)
        .select()
        .single();
      
      if (error) throw error;
      return data as ContractTemplate;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['contract-templates'] });
      toast({ title: 'Template created successfully' });
    },
    onError: (error: Error) => {
      toast({ title: 'Failed to create template', description: error.message, variant: 'destructive' });
    },
  });
}

export function useUpdateContractTemplate() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async ({ id, ...updates }: ContractTemplateUpdate) => {
      const { data, error } = await supabase
        .from('contract_templates')
        .update(updates)
        .eq('id', id)
        .select()
        .single();
      
      if (error) throw error;
      return data as ContractTemplate;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['contract-templates'] });
      queryClient.invalidateQueries({ queryKey: ['contract-templates', variables.id] });
      toast({ title: 'Template updated successfully' });
    },
    onError: (error: Error) => {
      toast({ title: 'Failed to update template', description: error.message, variant: 'destructive' });
    },
  });
}

export function useDeleteContractTemplate() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('contract_templates')
        .delete()
        .eq('id', id);
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['contract-templates'] });
      toast({ title: 'Template deleted successfully' });
    },
    onError: (error: Error) => {
      toast({ title: 'Failed to delete template', description: error.message, variant: 'destructive' });
    },
  });
}

// =============================================================
// CONTRACT GENERATION HOOK
// =============================================================

export interface GenerateContractParams {
  templateId: string;
  clientId: string;
  leadId?: string | null;
  quoteId?: string | null;
  eventId?: string | null;
  title: string;
}

export function useGenerateContractFromTemplate() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (params: GenerateContractParams) => {
      // Fetch template
      const { data: template, error: templateError } = await supabase
        .from('contract_templates')
        .select('*')
        .eq('id', params.templateId)
        .single();
      
      if (templateError || !template) {
        throw new Error('Template not found');
      }

      // Fetch client
      const { data: client } = await supabase
        .from('clients')
        .select('business_name, primary_contact_name')
        .eq('id', params.clientId)
        .single();

      // Fetch event and sessions if available
      let event = null;
      let sessions: any[] = [];
      
      if (params.eventId) {
        const { data: eventData } = await supabase
          .from('events')
          .select('venue_name, venue_address')
          .eq('id', params.eventId)
          .single();
        event = eventData;

        const { data: sessionData } = await supabase
          .from('event_sessions')
          .select('session_date, start_time, end_time')
          .eq('event_id', params.eventId)
          .order('session_date', { ascending: true });
        sessions = sessionData || [];
      } else if (params.leadId) {
        // Try to get sessions from lead
        const { data: sessionData } = await supabase
          .from('event_sessions')
          .select('session_date, start_time, end_time, venue_name, venue_address')
          .eq('lead_id', params.leadId)
          .order('session_date', { ascending: true });
        
        if (sessionData && sessionData.length > 0) {
          sessions = sessionData;
          // Use first session venue as event venue
          event = {
            venue_name: sessionData[0].venue_name,
            venue_address: sessionData[0].venue_address,
          };
        }
      }

      // Fetch quote if available
      let quote = null;
      if (params.quoteId) {
        const { data: quoteData } = await supabase
          .from('quotes')
          .select('quote_number, total_estimate')
          .eq('id', params.quoteId)
          .single();
        quote = quoteData;
      }

      // Build merge field context
      const context: MergeFieldContext = {
        client: client || undefined,
        event: event || undefined,
        sessions: sessions,
        quote: quote || undefined,
      };

      // Render the template
      const renderedHtml = renderMergeFields(template.body_html, context);

      // Create contract
      const { data: contract, error: contractError } = await supabase
        .from('contracts')
        .insert({
          title: params.title,
          client_id: params.clientId,
          lead_id: params.leadId,
          quote_id: params.quoteId,
          template_id: params.templateId,
          rendered_html: renderedHtml,
          status: 'draft',
        })
        .select()
        .single();

      if (contractError) throw contractError;
      return contract;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['contracts'] });
      toast({ title: 'Contract generated successfully' });
    },
    onError: (error: Error) => {
      toast({ title: 'Failed to generate contract', description: error.message, variant: 'destructive' });
    },
  });
}
