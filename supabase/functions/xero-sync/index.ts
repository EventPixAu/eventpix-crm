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

    let xeroToken = tokens[0];
    
    // Auto-refresh if token is expired or about to expire (within 60s)
    const expiresAt = new Date(xeroToken.expires_at);
    const now = new Date();
    const timeUntilExpiry = expiresAt.getTime() - now.getTime();
    console.log(`XERO-SYNC-V2: Token expires in ${Math.round(timeUntilExpiry / 1000)}s`);
    if (timeUntilExpiry < 60000) {
      console.log('XERO-SYNC-V2: Token expired or expiring soon, auto-refreshing...');
      const XERO_CLIENT_ID = Deno.env.get('XERO_CLIENT_ID');
      const XERO_CLIENT_SECRET = Deno.env.get('XERO_CLIENT_SECRET');
      
      if (!XERO_CLIENT_ID || !XERO_CLIENT_SECRET) {
        return new Response(
          JSON.stringify({ error: 'Xero credentials not configured for auto-refresh' }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      const tokenResponse = await fetch('https://identity.xero.com/connect/token', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          'Authorization': `Basic ${btoa(`${XERO_CLIENT_ID}:${XERO_CLIENT_SECRET}`)}`
        },
        body: new URLSearchParams({
          grant_type: 'refresh_token',
          refresh_token: xeroToken.refresh_token
        })
      });

      if (!tokenResponse.ok) {
        const errorText = await tokenResponse.text();
        console.error('Auto-refresh failed:', errorText);
        return new Response(
          JSON.stringify({ error: 'Xero token expired and auto-refresh failed. Please reconnect to Xero.' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      const newTokens = await tokenResponse.json();
      const newExpiresAt = new Date(Date.now() + newTokens.expires_in * 1000).toISOString();

      await supabase
        .from('xero_tokens')
        .update({
          access_token: newTokens.access_token,
          refresh_token: newTokens.refresh_token,
          expires_at: newExpiresAt,
          updated_at: new Date().toISOString()
        })
        .eq('id', xeroToken.id);

      xeroToken = { ...xeroToken, access_token: newTokens.access_token };
      console.log('Token auto-refreshed successfully');
    }

    // Helper to make Xero API calls with auto-retry on 401
    const makeXeroHeaders = () => ({
      'Authorization': `Bearer ${xeroToken.access_token}`,
      'xero-tenant-id': xeroToken.tenant_id,
      'Accept': 'application/json'
    });

    const refreshTokenAndRetry = async () => {
      const XERO_CLIENT_ID = Deno.env.get('XERO_CLIENT_ID');
      const XERO_CLIENT_SECRET = Deno.env.get('XERO_CLIENT_SECRET');
      if (!XERO_CLIENT_ID || !XERO_CLIENT_SECRET) throw new Error('Xero credentials not configured');

      const tokenResponse = await fetch('https://identity.xero.com/connect/token', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          'Authorization': `Basic ${btoa(`${XERO_CLIENT_ID}:${XERO_CLIENT_SECRET}`)}`
        },
        body: new URLSearchParams({
          grant_type: 'refresh_token',
          refresh_token: xeroToken.refresh_token
        })
      });

      if (!tokenResponse.ok) {
        const errorText = await tokenResponse.text();
        console.error('Token refresh failed:', errorText);
        throw new Error('Xero token refresh failed. Please reconnect to Xero.');
      }

      const newTokens = await tokenResponse.json();
      const newExpiresAt = new Date(Date.now() + newTokens.expires_in * 1000).toISOString();

      await supabase
        .from('xero_tokens')
        .update({
          access_token: newTokens.access_token,
          refresh_token: newTokens.refresh_token,
          expires_at: newExpiresAt,
          updated_at: new Date().toISOString()
        })
        .eq('id', xeroToken.id);

      xeroToken = { ...xeroToken, access_token: newTokens.access_token, refresh_token: newTokens.refresh_token };
      console.log('Token refreshed after 401');
    };

    // Fetch with auto-retry on 401
    const xeroFetch = async (url: string, options?: RequestInit): Promise<Response> => {
      let response = await fetch(url, { ...options, headers: { ...makeXeroHeaders(), ...options?.headers } });
      if (response.status === 401) {
        console.log('Got 401 from Xero, refreshing token and retrying...');
        await refreshTokenAndRetry();
        response = await fetch(url, { ...options, headers: { ...makeXeroHeaders(), ...options?.headers } });
      }
      return response;
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
            const response = await xeroFetch(searchUrl);

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

              // Update event if status changed or amount needs updating
              const invoiceAmount = invoice.Total || invoice.SubTotal || null;
              if (newStatus !== event.invoice_status || invoiceAmount) {
                const updateData: any = {
                  invoice_status: newStatus,
                  invoice_paid_at: paidAt,
                  updated_at: new Date().toISOString()
                };
                if (invoiceAmount) {
                  updateData.invoice_amount = invoiceAmount;
                }
                await supabase
                  .from('events')
                  .update(updateData)
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

        // Get event with Xero details
        const { data: event } = await supabase
          .from('events')
          .select('id, event_name, event_date, xero_tag, invoice_reference')
          .eq('id', eventId)
          .single();

        if (!event?.xero_tag) {
          return new Response(
            JSON.stringify({ error: 'Event has no Xero tag configured' }),
            { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        const normalise = (value: string | null | undefined) => (value ?? '').trim().toLowerCase();
        const tagNeedle = normalise(event.xero_tag);

        // Helper to categorize expense lines
        const categoriseLine = (desc: string): 'staff' | 'travel' | 'accommodation' | 'sundry' => {
          const d = desc.toLowerCase();
          if (d.includes('travel') || d.includes('fuel') || d.includes('mileage') || d.includes('transport') || d.includes('flight') || d.includes('airfare') || d.includes('uber') || d.includes('taxi') || d.includes('car hire')) {
            return 'travel';
          } else if (d.includes('hotel') || d.includes('accommodation') || d.includes('lodging') || d.includes('airbnb')) {
            return 'accommodation';
          } else if (d.includes('staff') || d.includes('wage') || d.includes('salary') || d.includes('contractor') || d.includes('subcontract')) {
            return 'staff';
          }
          return 'sundry';
        };

        const collectSearchStrings = (value: any): string[] => {
          if (value == null) return [];
          if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
            return [String(value)];
          }
          if (Array.isArray(value)) {
            return value.flatMap(collectSearchStrings);
          }
          if (typeof value === 'object') {
            return Object.values(value).flatMap(collectSearchStrings);
          }
          return [];
        };

        const matchesEventTag = (item: any, needle: string): boolean => {
          return collectSearchStrings(item).some((value) => normalise(value).includes(needle));
        };

        const extractLines = (txn: any, idField: string) => {
          const transactionMatches = matchesEventTag(txn, tagNeedle);
          const lineItems = Array.isArray(txn.LineItems) && txn.LineItems.length > 0
            ? txn.LineItems
            : [{
                Description: txn.Reference || txn.Contact?.Name || 'Xero expense',
                LineAmount: txn.Total ?? txn.SubTotal ?? 0,
                Tracking: [],
              }];

          return lineItems.flatMap((line: any, index: number) => {
            const lineMatches = matchesEventTag(line, tagNeedle);

            if (!transactionMatches && !lineMatches) {
              return [];
            }

            const amount = Math.abs(Number(line.LineAmount ?? line.UnitAmount ?? txn.Total ?? txn.SubTotal ?? 0));
            if (!Number.isFinite(amount) || amount === 0) {
              return [];
            }

            const description = line.Description || txn.Reference || txn.Contact?.Name || 'Xero expense';
            const categorisationInput = `${description} ${line.AccountCode || ''} ${txn.Type || ''}`;

            return [{
              event_id: eventId,
              expense_category: categoriseLine(categorisationInput),
              description,
              amount,
              expense_date: txn.DateString || txn.Date || null,
              xero_line_id: line.LineItemID || `${txn[idField] || 'txn'}-${index}`,
              xero_invoice_id: txn[idField] || null,
              synced_at: new Date().toISOString(),
            }];
          });
        };

        const fetchPagedRecords = async (endpoint: string, resultKey: string, maxPages = 10) => {
          const records: any[] = [];

          for (let page = 1; page <= maxPages; page++) {
            const separator = endpoint.includes('?') ? '&' : '?';
            const response = await xeroFetch(`${XERO_API_URL}/${endpoint}${separator}page=${page}`);

            if (!response.ok) {
              console.error(`Failed to fetch ${resultKey} page ${page}:`, await response.text());
              break;
            }

            const payload = await response.json();
            const pageRecords = Array.isArray(payload[resultKey]) ? payload[resultKey] : [];
            records.push(...pageRecords);

            if (pageRecords.length < 100) {
              break;
            }
          }

          return records;
        };

        const mapInvoiceStatus = (invoice: any) => {
          switch (invoice.Status) {
            case 'PAID':
              return {
                invoice_status: 'paid',
                invoice_paid_at: invoice.FullyPaidOnDate || new Date().toISOString(),
              };
            case 'AUTHORISED':
              return {
                invoice_status: new Date(invoice.DueDate) < new Date() ? 'overdue' : 'sent',
                invoice_paid_at: null,
              };
            case 'DRAFT':
              return { invoice_status: 'draft', invoice_paid_at: null };
            case 'VOIDED':
              return { invoice_status: 'void', invoice_paid_at: null };
            default:
              return { invoice_status: String(invoice.Status || '').toLowerCase() || null, invoice_paid_at: null };
          }
        };

        let syncedIncome = 0;
        if (event.invoice_reference) {
          const invoiceWhere = encodeURIComponent(`InvoiceNumber=="${event.invoice_reference.replaceAll('"', '\\"')}"`);
          const invoiceResponse = await xeroFetch(`${XERO_API_URL}/Invoices?where=${invoiceWhere}`);

          if (invoiceResponse.ok) {
            const invoicePayload = await invoiceResponse.json();
            const invoice = invoicePayload.Invoices?.[0];

            if (invoice) {
              syncedIncome = Number(invoice.Total || invoice.SubTotal || 0);
              const mappedStatus = mapInvoiceStatus(invoice);
              await supabase
                .from('events')
                .update({
                  invoice_amount: syncedIncome || null,
                  invoice_status: mappedStatus.invoice_status,
                  invoice_paid_at: mappedStatus.invoice_paid_at,
                  updated_at: new Date().toISOString(),
                })
                .eq('id', eventId);

              console.log(`Synced invoice ${event.invoice_reference}: $${syncedIncome}`);
            }
          } else {
            console.error(`Failed to fetch invoice ${event.invoice_reference}:`, await invoiceResponse.text());
          }
        }

        console.log(`Searching for expenses with tag: "${event.xero_tag}"`);

        // Try to find tracking for logging/debugging, but do not require it.
        const tcResponse = await xeroFetch(`${XERO_API_URL}/TrackingCategories`);
        if (tcResponse.ok) {
          const tcData = await tcResponse.json();
          let trackingCategoryID: string | null = null;
          let trackingOptionID: string | null = null;
          let trackingCategoryName: string | null = null;

          for (const category of tcData.TrackingCategories || []) {
            for (const option of category.Options || []) {
              if (normalise(option.Name) === tagNeedle) {
                trackingCategoryID = category.TrackingCategoryID;
                trackingOptionID = option.TrackingOptionID;
                trackingCategoryName = category.Name;
                break;
              }
            }
            if (trackingCategoryID) break;
          }

          if (trackingCategoryID && trackingOptionID) {
            console.log(`Found tracking: "${trackingCategoryName}" > "${event.xero_tag}" (${trackingCategoryID}/${trackingOptionID})`);
          } else {
            console.log(`No exact tracking option found for tag "${event.xero_tag}", falling back to transaction text matching`);
          }
        }

        const billWhere = encodeURIComponent('Type=="ACCPAY"');
        const bills = await fetchPagedRecords(`Invoices?where=${billWhere}`, 'Invoices');
        let expenses = bills.flatMap((bill: any) => extractLines(bill, 'InvoiceID'));
        console.log(`Matched ${expenses.length} expense lines from bills`);

        // Fallback to spend transactions when no tagged bills are found.
        if (expenses.length === 0) {
          const bankTransactions = await fetchPagedRecords('BankTransactions', 'BankTransactions');
          expenses = bankTransactions
            .filter((txn: any) => ['SPEND', 'SPEND-PREPAYMENT', 'SPEND-OVERPAYMENT'].includes(String(txn.Type || '')))
            .flatMap((txn: any) => extractLines(txn, 'BankTransactionID'));
          console.log(`Matched ${expenses.length} expense lines from bank transactions`);
        }

        const dedupedExpenses = Array.from(
          new Map(expenses.map((expense: any) => [
            expense.xero_line_id || `${expense.xero_invoice_id}-${expense.description}-${expense.amount}`,
            expense,
          ])).values(),
        );

        expenses = dedupedExpenses;
        console.log(`Found ${expenses.length} expense entries to sync`);

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
