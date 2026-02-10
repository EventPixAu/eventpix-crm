/**
 * XERO SYNC HANDLER
 * 
 * Syncs invoice statuses and expenses from Xero:
 * - /invoices - Sync invoice payment statuses
 * - /expenses - Sync expenses by event tag
 */

import { createClient } from "npm:@supabase/supabase-js@2";

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

        // Helper to categorize expense lines
        const categoriseLine = (desc: string): 'staff' | 'travel' | 'accommodation' | 'sundry' => {
          const d = desc.toLowerCase();
          if (d.includes('travel') || d.includes('fuel') || d.includes('mileage') || d.includes('transport') || d.includes('flight') || d.includes('airfare') || d.includes('uber') || d.includes('taxi') || d.includes('car hire')) {
            return 'travel';
          } else if (d.includes('hotel') || d.includes('accommodation') || d.includes('lodging') || d.includes('airbnb')) {
            return 'accommodation';
          } else if (d.includes('staff') || d.includes('wage') || d.includes('salary') || d.includes('contractor')) {
            return 'staff';
          }
          return 'sundry';
        };

        // Helper to check if a transaction matches the event tag
        const matchesEventTag = (item: any, tag: string): boolean => {
          return (
            item.Reference?.includes(tag) ||
            item.LineItems?.some((line: any) =>
              line.Description?.includes(tag) ||
              line.Tracking?.some((t: any) => t.Option?.includes(tag))
            )
          );
        };

        // Helper to extract expense lines from a matched transaction
        const extractLines = (txn: any, tag: string, idField: string) => {
          const lines: any[] = [];
          for (const line of txn.LineItems || []) {
            // Check if this specific line matches the tag via tracking
            const lineMatchesTag = line.Tracking?.some((t: any) => t.Option?.includes(tag));
            // If the whole transaction matches by Reference, include all lines
            // If only some lines match by tracking, include only those
            const txnMatchesByRef = txn.Reference?.includes(tag);
            if (!txnMatchesByRef && !lineMatchesTag) continue;

            // Use tracking category name or account name to help categorise
            const accountName = (line.AccountCode || '').toLowerCase();
            const trackingName = line.Tracking?.map((t: any) => t.Name || '').join(' ').toLowerCase() || '';
            const descForCat = `${line.Description || ''} ${accountName} ${trackingName}`;

            lines.push({
              event_id: eventId,
              expense_category: categoriseLine(descForCat),
              description: line.Description || txn.Reference || 'Xero expense',
              amount: Math.abs(line.LineAmount || 0),
              expense_date: txn.Date || txn.DateString || null,
              xero_line_id: line.LineItemID,
              xero_invoice_id: txn[idField],
              synced_at: new Date().toISOString()
            });
          }
          return lines;
        };

        const expenses: any[] = [];

        // 1) Search Bills (Accounts Payable invoices)
        const billsUrl = `${XERO_API_URL}/Invoices?where=Type=="ACCPAY"&page=1`;
        const billsResponse = await fetch(billsUrl, { headers: xeroHeaders });
        if (billsResponse.ok) {
          const billsData = await billsResponse.json();
          for (const bill of billsData.Invoices || []) {
            if (matchesEventTag(bill, event.xero_tag)) {
              expenses.push(...extractLines(bill, event.xero_tag, 'InvoiceID'));
            }
          }
        } else {
          console.error('Failed to fetch bills:', await billsResponse.text());
        }

        // 2) Search Bank Transactions (Spend Money / Receive Money)
        // This is where most tagged expenses live (credit card transactions, etc.)
        const bankTxnUrl = `${XERO_API_URL}/BankTransactions?where=Type=="SPEND"&page=1`;
        const bankResponse = await fetch(bankTxnUrl, { headers: xeroHeaders });
        if (bankResponse.ok) {
          const bankData = await bankResponse.json();
          for (const txn of bankData.BankTransactions || []) {
            if (matchesEventTag(txn, event.xero_tag)) {
              expenses.push(...extractLines(txn, event.xero_tag, 'BankTransactionID'));
            }
          }
        } else {
          console.error('Failed to fetch bank transactions:', await bankResponse.text());
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
