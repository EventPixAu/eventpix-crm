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
// Extended to match Studio Ninja merge fields
export interface MergeFieldContext {
  client?: {
    business_name?: string | null;
    primary_contact_name?: string | null;
    primary_contact_email?: string | null;
    primary_contact_phone?: string | null;
    billing_address?: string | null;
    abn?: string | null;
  };
  event?: {
    event_name?: string | null;
    event_date?: string | null;
    main_shoot_date?: string | null;
    start_time?: string | null;
    end_time?: string | null;
    venue_name?: string | null;
    venue_address?: string | null;
    event_type?: string | null;
    coverage_details?: string | null;
    notes?: string | null;
  };
  sessions?: Array<{
    session_date: string;
    start_time?: string | null;
    end_time?: string | null;
    venue_name?: string | null;
    venue_address?: string | null;
    label?: string | null;
  }>;
  quote?: {
    quote_number?: string | null;
    subtotal?: number | null;
    tax_total?: number | null;
    total_estimate?: number | null;
    valid_until?: string | null;
  };
  lead?: {
    lead_name?: string | null;
    contact_name?: string | null;
    contact_email?: string | null;
    contact_phone?: string | null;
  };
  // Additional context
  today?: string;
  company_name?: string;
}

// Format sessions for merge field
function formatSessions(sessions: MergeFieldContext['sessions']): string {
  if (!sessions || sessions.length === 0) return 'TBD';
  
  return sessions.map(session => {
    const date = format(new Date(session.session_date), 'd MMM yyyy');
    const start = session.start_time ? session.start_time.slice(0, 5) : '';
    const end = session.end_time ? session.end_time.slice(0, 5) : '';
    const venue = session.venue_name || '';
    const label = session.label ? `${session.label}: ` : '';
    
    let timeStr = '';
    if (start && end) {
      timeStr = ` ${start}–${end}`;
    } else if (start) {
      timeStr = ` ${start}`;
    }
    
    let venueStr = venue ? ` @ ${venue}` : '';
    
    return `${label}${date}${timeStr}${venueStr}`;
  }).join('\n');
}

// Format date for display
function formatDate(dateStr: string | null | undefined): string {
  if (!dateStr) return 'TBD';
  try {
    return format(new Date(dateStr), 'd MMMM yyyy');
  } catch {
    return dateStr;
  }
}

// Format time for display
function formatTime(timeStr: string | null | undefined): string {
  if (!timeStr) return '';
  return timeStr.slice(0, 5);
}

// Format currency
function formatCurrency(value: number | null | undefined): string {
  if (value == null) return '$0.00';
  return new Intl.NumberFormat('en-AU', { 
    style: 'currency', 
    currency: 'AUD' 
  }).format(value);
}

// Available merge fields reference (for template editor)
export const AVAILABLE_MERGE_FIELDS = [
  // Client fields
  { field: '{{client.business_name}}', label: 'Client Business Name', category: 'Client' },
  { field: '{{client.primary_contact_name}}', label: 'Primary Contact Name', category: 'Client' },
  { field: '{{client.primary_contact_email}}', label: 'Primary Contact Email', category: 'Client' },
  { field: '{{client.primary_contact_phone}}', label: 'Primary Contact Phone', category: 'Client' },
  { field: '{{client.billing_address}}', label: 'Billing Address', category: 'Client' },
  { field: '{{client.abn}}', label: 'ABN', category: 'Client' },
  // Event/Job fields
  { field: '{{event.event_name}}', label: 'Job Name', category: 'Job' },
  { field: '{{event.event_date}}', label: 'Event Date', category: 'Job' },
  { field: '{{event.main_shoot_date}}', label: 'Main Shoot Date', category: 'Job' },
  { field: '{{event.start_time}}', label: 'Start Time', category: 'Job' },
  { field: '{{event.end_time}}', label: 'End Time', category: 'Job' },
  { field: '{{event.venue_name}}', label: 'Venue Name', category: 'Job' },
  { field: '{{event.venue_address}}', label: 'Venue Address', category: 'Job' },
  { field: '{{event.event_type}}', label: 'Event Type', category: 'Job' },
  { field: '{{event.coverage_details}}', label: 'Coverage Details', category: 'Job' },
  { field: '{{event.sessions}}', label: 'All Sessions (formatted)', category: 'Job' },
  // Quote fields
  { field: '{{quote.quote_number}}', label: 'Quote Number', category: 'Quote' },
  { field: '{{quote.subtotal}}', label: 'Subtotal', category: 'Quote' },
  { field: '{{quote.tax_total}}', label: 'Tax Total', category: 'Quote' },
  { field: '{{quote.total_estimate}}', label: 'Total Amount', category: 'Quote' },
  { field: '{{quote.valid_until}}', label: 'Quote Valid Until', category: 'Quote' },
  // Lead fields (for leads not yet converted)
  { field: '{{lead.lead_name}}', label: 'Lead Name', category: 'Lead' },
  { field: '{{lead.contact_name}}', label: 'Lead Contact Name', category: 'Lead' },
  { field: '{{lead.contact_email}}', label: 'Lead Contact Email', category: 'Lead' },
  { field: '{{lead.contact_phone}}', label: 'Lead Contact Phone', category: 'Lead' },
  // System fields
  { field: '{{today}}', label: 'Today\'s Date', category: 'System' },
  { field: '{{company_name}}', label: 'Your Company Name', category: 'System' },
];

// Render merge fields in template HTML
export function renderMergeFields(html: string, context: MergeFieldContext): string {
  let rendered = html;
  
  // Client fields
  rendered = rendered.replace(/\{\{client\.business_name\}\}/g, context.client?.business_name || '');
  rendered = rendered.replace(/\{\{client\.primary_contact_name\}\}/g, context.client?.primary_contact_name || '');
  rendered = rendered.replace(/\{\{client\.primary_contact_email\}\}/g, context.client?.primary_contact_email || '');
  rendered = rendered.replace(/\{\{client\.primary_contact_phone\}\}/g, context.client?.primary_contact_phone || '');
  rendered = rendered.replace(/\{\{client\.billing_address\}\}/g, context.client?.billing_address || '');
  rendered = rendered.replace(/\{\{client\.abn\}\}/g, context.client?.abn || '');
  
  // Event/Job fields
  rendered = rendered.replace(/\{\{event\.event_name\}\}/g, context.event?.event_name || '');
  rendered = rendered.replace(/\{\{event\.event_date\}\}/g, formatDate(context.event?.event_date));
  rendered = rendered.replace(/\{\{event\.main_shoot_date\}\}/g, formatDate(context.event?.main_shoot_date));
  rendered = rendered.replace(/\{\{event\.start_time\}\}/g, formatTime(context.event?.start_time));
  rendered = rendered.replace(/\{\{event\.end_time\}\}/g, formatTime(context.event?.end_time));
  rendered = rendered.replace(/\{\{event\.venue_name\}\}/g, context.event?.venue_name || '');
  rendered = rendered.replace(/\{\{event\.venue_address\}\}/g, context.event?.venue_address || '');
  rendered = rendered.replace(/\{\{event\.event_type\}\}/g, context.event?.event_type || '');
  rendered = rendered.replace(/\{\{event\.coverage_details\}\}/g, context.event?.coverage_details || '');
  rendered = rendered.replace(/\{\{event\.sessions\}\}/g, formatSessions(context.sessions));
  
  // Quote fields
  rendered = rendered.replace(/\{\{quote\.quote_number\}\}/g, context.quote?.quote_number || '');
  rendered = rendered.replace(/\{\{quote\.subtotal\}\}/g, formatCurrency(context.quote?.subtotal));
  rendered = rendered.replace(/\{\{quote\.tax_total\}\}/g, formatCurrency(context.quote?.tax_total));
  rendered = rendered.replace(/\{\{quote\.total_estimate\}\}/g, formatCurrency(context.quote?.total_estimate));
  rendered = rendered.replace(/\{\{quote\.valid_until\}\}/g, formatDate(context.quote?.valid_until));
  
  // Lead fields
  rendered = rendered.replace(/\{\{lead\.lead_name\}\}/g, context.lead?.lead_name || '');
  rendered = rendered.replace(/\{\{lead\.contact_name\}\}/g, context.lead?.contact_name || '');
  rendered = rendered.replace(/\{\{lead\.contact_email\}\}/g, context.lead?.contact_email || '');
  rendered = rendered.replace(/\{\{lead\.contact_phone\}\}/g, context.lead?.contact_phone || '');
  
  // System fields
  rendered = rendered.replace(/\{\{today\}\}/g, context.today || format(new Date(), 'd MMMM yyyy'));
  rendered = rendered.replace(/\{\{company_name\}\}/g, context.company_name || 'Eventpix');
  
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

      // Fetch client with full details
      const { data: client } = await supabase
        .from('clients')
        .select('business_name, primary_contact_name, primary_contact_email, primary_contact_phone, billing_address, abn')
        .eq('id', params.clientId)
        .single();

      // Fetch event and sessions if available
      let event = null;
      let sessions: any[] = [];
      let eventTypeInfo = null;
      
      if (params.eventId) {
        const { data: eventData } = await supabase
          .from('events')
          .select(`
            event_name,
            event_date,
            main_shoot_date,
            start_time,
            end_time,
            venue_name,
            venue_address,
            event_type_id,
            coverage_details,
            notes
          `)
          .eq('id', params.eventId)
          .single();
        
        if (eventData) {
          // Get event type name
          if (eventData.event_type_id) {
            const { data: typeData } = await supabase
              .from('event_types')
              .select('name')
              .eq('id', eventData.event_type_id)
              .single();
            eventTypeInfo = typeData?.name;
          }
          
          event = {
            ...eventData,
            event_type: eventTypeInfo,
          };
        }

        const { data: sessionData } = await supabase
          .from('event_sessions')
          .select('session_date, start_time, end_time, venue_name, venue_address, label')
          .eq('event_id', params.eventId)
          .order('session_date', { ascending: true });
        sessions = sessionData || [];
      }
      
      // Try to get sessions from lead if no event
      let lead = null;
      if (params.leadId) {
        const { data: leadData } = await supabase
          .from('leads')
          .select('lead_name, contact_name, contact_email, contact_phone')
          .eq('id', params.leadId)
          .single();
        lead = leadData;
        
        if (sessions.length === 0) {
          const { data: sessionData } = await supabase
            .from('event_sessions')
            .select('session_date, start_time, end_time, venue_name, venue_address, label')
            .eq('lead_id', params.leadId)
            .order('session_date', { ascending: true });
          
          if (sessionData && sessionData.length > 0) {
            sessions = sessionData;
            // Use first session venue as event venue if no event data
            if (!event) {
              event = {
                venue_name: sessionData[0].venue_name,
                venue_address: sessionData[0].venue_address,
              };
            }
          }
        }
      }

      // Fetch quote if available
      let quote = null;
      if (params.quoteId) {
        const { data: quoteData } = await supabase
          .from('quotes')
          .select('quote_number, subtotal, tax_total, total_estimate, expires_at')
          .eq('id', params.quoteId)
          .single();
        quote = quoteData ? {
          ...quoteData,
          valid_until: quoteData.expires_at,
        } : null;
      }

      // Build merge field context
      const context: MergeFieldContext = {
        client: client || undefined,
        event: event || undefined,
        sessions: sessions,
        quote: quote || undefined,
        lead: lead || undefined,
        today: format(new Date(), 'd MMMM yyyy'),
        company_name: 'Eventpix',
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
          event_id: params.eventId,
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
