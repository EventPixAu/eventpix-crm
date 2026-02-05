/**
 * XERO SYNC HANDLER
 * 
 * Syncs invoice statuses and expenses from Xero:
 * - /invoices - Sync invoice payment statuses
 * - /expenses - Sync expenses by event tag
 */

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const XERO_API_URL = 'https://api.xero.com/api.xro/2.0';

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const url = new URL(req.url);
  const path = url.pathname.split('/').pop();

  const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
  const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

  // Verify admin access
  const authHeader = req.headers.get('Authorization');
  if (!authHeader) {
    return new Response(
      JSON.stringify({ error: 'Unauthorized' }),
      { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  const token = authHeader.replace('Bearer ', '');
  const { data: userData, error: userError } = await supabase.auth.getUser(token);
  
  if (userError || !userData.user) {
    return new Response(
      JSON.stringify({ error: 'Unauthorized' }),
      { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  const { data: roles } = await supabase
    .from('user_roles')
    .select('role')
    .eq('user_id', userData.user.id);
  
  const isAdmin = roles?.some(r => r.role === 'admin');
  if (!isAdmin) {
    return new Response(
      JSON.stringify({ error: 'Admin access required' }),
      { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  try {
    // Get valid access token
    const { data: tokens } = await supabase
      .from('xero_tokens')
      .select('*')
      .order('updated_at', { ascending: false })
      .limit(1);

    if (!tokens?.length) {
      return new Response(
        JSON.stringify({ error: 'Xero not connected' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const xeroToken = tokens[0];
    
    // Check if token is expired
    if (new Date(xeroToken.expires_at) < new Date()) {
      return new Response(
        JSON.stringify({ error: 'Xero token expired. Please refresh.' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const xeroHeaders = {
      'Authorization': `Bearer ${xeroToken.access_token}`,
      'xero-tenant-id': xeroToken.tenant_id,
      'Accept': 'application/json'
    };

    switch (path) {
      case 'invoices': {
        // Get events with invoice references
        const { data: events } = await supabase
          .from('events')
          .select('id, event_name, invoice_reference, invoice_status, xero_tag')
          .not('invoice_reference', 'is', null);

        if (!events?.length) {
          return new Response(
            JSON.stringify({ synced: 0, message: 'No events with invoice references' }),
            { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        // Create sync log
        const { data: logEntry } = await supabase
          .from('xero_sync_log')
          .insert({
            sync_type: 'invoice_status',
            status: 'running',
            created_by: userData.user.id
          })
          .select()
          .single();

        let synced = 0;
        const results: any[] = [];

        for (const event of events) {
          try {
            // Search for invoice by reference number
            const searchUrl = `${XERO_API_URL}/Invoices?where=InvoiceNumber=="${event.invoice_reference}"`;
            const response = await fetch(searchUrl, { headers: xeroHeaders });

            if (!response.ok) {
              console.error(`Failed to fetch invoice for ${event.invoice_reference}:`, await response.text());
              continue;
            }

            const data = await response.json();
            const invoice = data.Invoices?.[0];

            if (invoice) {
              // Map Xero status to our status
              let newStatus: string;
              let paidAt: string | null = null;

              switch (invoice.Status) {
                case 'PAID':
                  newStatus = 'paid';
                  paidAt = invoice.FullyPaidOnDate || new Date().toISOString();
                  break;
                case 'AUTHORISED':
                  // Check if overdue
                  newStatus = new Date(invoice.DueDate) < new Date() ? 'overdue' : 'sent';
                  break;
                case 'DRAFT':
                  newStatus = 'draft';
                  break;
                case 'VOIDED':
                  newStatus = 'void';
                  break;
                default:
                  newStatus = invoice.Status.toLowerCase();
              }

              // Update event if status changed
              if (newStatus !== event.invoice_status) {
                await supabase
                  .from('events')
                  .update({
                    invoice_status: newStatus,
                    invoice_paid_at: paidAt,
                    updated_at: new Date().toISOString()
                  })
                  .eq('id', event.id);

                results.push({
                  eventId: event.id,
                  eventName: event.event_name,
                  oldStatus: event.invoice_status,
                  newStatus,
                  paidAt
                });
                synced++;
              }
            }
          } catch (err) {
            console.error(`Error syncing invoice for event ${event.id}:`, err);
          }
        }

        // Update sync log
        await supabase
          .from('xero_sync_log')
          .update({
            status: 'completed',
            completed_at: new Date().toISOString(),
            events_synced: synced
          })
          .eq('id', logEntry?.id);

        return new Response(
          JSON.stringify({ synced, results }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      case 'expenses': {
        const body = await req.json().catch(() => ({}));
        const eventId = body.eventId;

        if (!eventId) {
          return new Response(
            JSON.stringify({ error: 'eventId required' }),
            { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        // Get event with xero tag
        const { data: event } = await supabase
          .from('events')
          .select('id, event_name, xero_tag')
          .eq('id', eventId)
          .single();

        if (!event?.xero_tag) {
          return new Response(
            JSON.stringify({ error: 'Event has no Xero tag configured' }),
            { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        // Search for invoices/bills with this tracking category
        // Note: Xero uses tracking categories or reference fields for tagging
        // We'll search for bills (expenses) with the tag in Reference
        const searchUrl = `${XERO_API_URL}/Invoices?where=Type=="ACCPAY"`;
        const response = await fetch(searchUrl, { headers: xeroHeaders });

        if (!response.ok) {
          const errorText = await response.text();
          console.error('Failed to fetch expenses:', errorText);
          return new Response(
            JSON.stringify({ error: 'Failed to fetch expenses from Xero', details: errorText }),
            { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        const data = await response.json();
        const expenses: any[] = [];

        // Filter bills that match our tag (in Reference or LineItem descriptions)
        for (const bill of data.Invoices || []) {
          const matchesTag = 
            bill.Reference?.includes(event.xero_tag) ||
            bill.LineItems?.some((line: any) => 
              line.Description?.includes(event.xero_tag) ||
              line.Tracking?.some((t: any) => t.Option?.includes(event.xero_tag))
            );

          if (matchesTag) {
            for (const line of bill.LineItems || []) {
              // Categorize based on account or description
              let category: 'staff' | 'travel' | 'accommodation' | 'sundry' = 'sundry';
              const desc = (line.Description || '').toLowerCase();
              const accountName = (line.AccountCode || '').toLowerCase();

              if (desc.includes('travel') || desc.includes('fuel') || desc.includes('mileage') || desc.includes('transport')) {
                category = 'travel';
              } else if (desc.includes('hotel') || desc.includes('accommodation') || desc.includes('lodging')) {
                category = 'accommodation';
              } else if (desc.includes('staff') || desc.includes('wage') || desc.includes('salary') || desc.includes('contractor')) {
                category = 'staff';
              }

              expenses.push({
                event_id: eventId,
                expense_category: category,
                description: line.Description || bill.Reference || 'Xero expense',
                amount: line.LineAmount || 0,
                expense_date: bill.Date,
                xero_line_id: line.LineItemID,
                xero_invoice_id: bill.InvoiceID,
                synced_at: new Date().toISOString()
              });
            }
          }
        }

        // Clear existing synced expenses and insert new ones
        await supabase
          .from('event_expenses')
          .delete()
          .eq('event_id', eventId)
          .not('xero_invoice_id', 'is', null);

        if (expenses.length > 0) {
          await supabase
            .from('event_expenses')
            .insert(expenses);
        }

        return new Response(
          JSON.stringify({ 
            synced: expenses.length, 
            expenses: expenses.map(e => ({
              category: e.expense_category,
              description: e.description,
              amount: e.amount
            }))
          }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      default:
        return new Response(
          JSON.stringify({ error: 'Unknown endpoint' }),
          { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
    }
  } catch (error) {
    console.error('Xero sync error:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
