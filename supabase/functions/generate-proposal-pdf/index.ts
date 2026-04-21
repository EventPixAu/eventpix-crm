import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

interface GeneratePdfRequest {
  quoteId: string;
}

interface QuoteItem {
  id: string;
  description: string;
  quantity: number;
  unit_price: number;
  line_total: number;
  group_label: string | null;
  product?: {
    name: string;
    description: string | null;
  } | null;
}

const formatCurrency = (value: number) => {
  return new Intl.NumberFormat('en-AU', { style: 'currency', currency: 'AUD' }).format(value);
};

const formatDate = (dateStr: string | null) => {
  if (!dateStr) return '—';
  const date = new Date(dateStr);
  return date.toLocaleDateString('en-AU', { day: 'numeric', month: 'long', year: 'numeric' });
};

const handler = async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Authenticate request
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(
        JSON.stringify({ success: false, error: "Unauthorized" }),
        { status: 401, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    const token = authHeader.replace("Bearer ", "");
    const { data: userData, error: authError } = await supabase.auth.getUser(token);
    
    if (authError || !userData.user) {
      return new Response(
        JSON.stringify({ success: false, error: "Invalid token" }),
        { status: 401, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    // Server-side role check
    const { data: roleRows } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", userData.user.id);
    const allowedRoles = new Set(["admin", "operations", "sales"]);
    if (!(roleRows || []).some((r: any) => allowedRoles.has(r.role))) {
      return new Response(
        JSON.stringify({ success: false, error: "Forbidden" }),
        { status: 403, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    const body: GeneratePdfRequest = await req.json();
    const { quoteId } = body;

    if (!quoteId) {
      return new Response(
        JSON.stringify({ success: false, error: "Missing quoteId" }),
        { status: 400, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    // Fetch quote with related data
    const { data: quote, error: quoteError } = await supabase
      .from("quotes")
      .select(`
        *,
        client:clients(*),
        lead:leads(
          *,
          client:clients(*),
          event_sessions(*)
        )
      `)
      .eq("id", quoteId)
      .single();

    if (quoteError || !quote) {
      console.error("Quote fetch error:", quoteError);
      return new Response(
        JSON.stringify({ success: false, error: "Quote not found" }),
        { status: 404, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    // Fetch quote items
    const { data: items, error: itemsError } = await supabase
      .from("quote_items")
      .select(`
        *,
        product:products(name, description)
      `)
      .eq("quote_id", quoteId)
      .order("sort_order");

    if (itemsError) {
      console.error("Quote items fetch error:", itemsError);
    }

    // Fetch site settings
    const { data: settingsData } = await supabase
      .from("site_settings")
      .select("key, value");
    
    const settings: Record<string, string> = {};
    settingsData?.forEach((s: { key: string; value: string }) => {
      settings[s.key] = s.value;
    });

    // Fetch lead contacts for primary contact
    let primaryContactName = '';
    let primaryContactEmail = '';
    
    if (quote.lead?.id) {
      const { data: leadContacts } = await supabase
        .from("enquiry_contacts")
        .select(`
          *,
          client_contact:client_contacts(contact_name, email, first_name)
        `)
        .eq("lead_id", quote.lead.id)
        .order("created_at")
        .limit(5);
      
      const primary = leadContacts?.find((c: any) => c.role === 'primary') || leadContacts?.[0];
      if (primary) {
        primaryContactName = primary.client_contact?.contact_name || primary.contact_name || '';
        primaryContactEmail = primary.client_contact?.email || primary.contact_email || '';
      }
    }

    // Resolve client data
    const clientData = quote.client || quote.lead?.client;
    const clientName = clientData?.business_name || '';
    const contactName = primaryContactName || clientData?.primary_contact_name || '';
    const contactEmail = primaryContactEmail || clientData?.primary_contact_email || '';

    // Event details
    const leadData = quote.lead;
    const eventSessions = leadData?.event_sessions;
    const eventDate = eventSessions?.[0]?.session_date || leadData?.estimated_event_date;

    // Group items
    const groupedItems: Record<string, QuoteItem[]> = {};
    (items || []).forEach((item: QuoteItem) => {
      const group = item.group_label || 'Other';
      if (!groupedItems[group]) groupedItems[group] = [];
      groupedItems[group].push(item);
    });

    const GROUP_LABELS = ['Coverage', 'Delivery', 'Add-ons', 'Equipment', 'Travel', 'Other'];
    const sortedGroupKeys = Object.keys(groupedItems).sort((a, b) => {
      const indexA = GROUP_LABELS.indexOf(a);
      const indexB = GROUP_LABELS.indexOf(b);
      if (indexA === -1 && indexB === -1) return a.localeCompare(b);
      if (indexA === -1) return 1;
      if (indexB === -1) return -1;
      return indexA - indexB;
    });

    // Build acceptance URL with QR code
    const baseUrl = Deno.env.get("SITE_URL") || "https://app.eventpix.com.au";
    const acceptUrl = quote.public_token ? `${baseUrl}/accept/${quote.public_token}` : '';

    // Generate HTML for PDF
    const html = generateProposalHtml({
      quote,
      items: items || [],
      groupedItems,
      sortedGroupKeys,
      settings,
      clientName,
      contactName,
      contactEmail,
      eventDate,
      leadData,
      acceptUrl,
    });

    // Return HTML as base64 for now (client will use html2pdf or print)
    // In future, could use a PDF generation service
    const base64Html = btoa(unescape(encodeURIComponent(html)));

    return new Response(
      JSON.stringify({ 
        success: true, 
        html: html,
        htmlBase64: base64Html,
        quote: {
          quote_number: quote.quote_number,
          client_name: clientName,
          total: quote.total_estimate,
        }
      }),
      { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders } }
    );

  } catch (error: unknown) {
    console.error("Error in generate-proposal-pdf:", error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return new Response(
      JSON.stringify({ success: false, error: errorMessage }),
      { status: 500, headers: { "Content-Type": "application/json", ...corsHeaders } }
    );
  }
};

interface GenerateHtmlParams {
  quote: any;
  items: QuoteItem[];
  groupedItems: Record<string, QuoteItem[]>;
  sortedGroupKeys: string[];
  settings: Record<string, string>;
  clientName: string;
  contactName: string;
  contactEmail: string;
  eventDate: string | null;
  leadData: any;
  acceptUrl: string;
}

function generateProposalHtml(params: GenerateHtmlParams): string {
  const { quote, items, groupedItems, sortedGroupKeys, settings, clientName, contactName, contactEmail, eventDate, leadData, acceptUrl } = params;
  
  const quoteVersion = quote.quote_version || 1;
  const hasGroupedItems = sortedGroupKeys.length > 1 || (sortedGroupKeys.length === 1 && sortedGroupKeys[0] !== 'Other');

  // Generate line items HTML
  let itemsHtml = '';
  
  if (hasGroupedItems) {
    sortedGroupKeys.forEach(groupKey => {
      itemsHtml += `
        <h3 style="font-size: 14px; font-weight: 600; margin: 16px 0 8px 0; color: #111;">${groupKey}</h3>
        <table style="width: 100%; border-collapse: collapse; margin-bottom: 16px;">
          <thead>
            <tr style="background-color: #0891b2;">
              <th style="padding: 8px 12px; text-align: left; color: white; font-weight: 600;">Description</th>
              <th style="padding: 8px 12px; text-align: right; color: white; font-weight: 600; width: 60px;">Qty</th>
              <th style="padding: 8px 12px; text-align: right; color: white; font-weight: 600; width: 100px;">Unit Price</th>
              <th style="padding: 8px 12px; text-align: right; color: white; font-weight: 600; width: 100px;">Amount</th>
            </tr>
          </thead>
          <tbody>
            ${groupedItems[groupKey].map(item => {
              const name = item.product?.name || item.description;
              return `
                <tr style="border-bottom: 1px solid #e5e7eb;">
                  <td style="padding: 8px 12px; color: #111;">${name}</td>
                  <td style="padding: 8px 12px; text-align: right; color: #111;">${item.quantity}</td>
                  <td style="padding: 8px 12px; text-align: right; color: #111;">${formatCurrency(item.unit_price)}</td>
                  <td style="padding: 8px 12px; text-align: right; color: #111;">${formatCurrency(item.quantity * item.unit_price)}</td>
                </tr>
              `;
            }).join('')}
          </tbody>
        </table>
      `;
    });
  } else {
    itemsHtml = `
      <table style="width: 100%; border-collapse: collapse; margin-bottom: 16px;">
        <thead>
          <tr style="background-color: #0891b2;">
            <th style="padding: 8px 12px; text-align: left; color: white; font-weight: 600;">Description</th>
            <th style="padding: 8px 12px; text-align: right; color: white; font-weight: 600; width: 60px;">Qty</th>
            <th style="padding: 8px 12px; text-align: right; color: white; font-weight: 600; width: 100px;">Unit Price</th>
            <th style="padding: 8px 12px; text-align: right; color: white; font-weight: 600; width: 100px;">Amount</th>
          </tr>
        </thead>
        <tbody>
          ${items.map(item => {
            const name = item.product?.name || item.description;
            return `
              <tr style="border-bottom: 1px solid #e5e7eb;">
                <td style="padding: 8px 12px; color: #111;">${name}</td>
                <td style="padding: 8px 12px; text-align: right; color: #111;">${item.quantity}</td>
                <td style="padding: 8px 12px; text-align: right; color: #111;">${formatCurrency(item.unit_price)}</td>
                <td style="padding: 8px 12px; text-align: right; color: #111;">${formatCurrency(item.quantity * item.unit_price)}</td>
              </tr>
            `;
          }).join('')}
        </tbody>
      </table>
    `;
  }

  // QR code section (using a QR code API service)
  const qrCodeHtml = acceptUrl ? `
    <div style="margin: 24px 0; padding: 20px; border: 1px solid #e5e7eb; border-radius: 8px; background-color: #f9fafb; display: flex; align-items: center; gap: 20px;">
      <img src="https://api.qrserver.com/v1/create-qr-code/?size=100x100&data=${encodeURIComponent(acceptUrl)}" alt="QR Code" style="width: 100px; height: 100px;" />
      <div>
        <p style="margin: 0 0 4px 0; font-weight: 600; color: #111;">Accept this proposal online</p>
        <p style="margin: 0; font-size: 12px; color: #666;">Scan this QR code with your phone camera to view and accept this proposal online.</p>
        <p style="margin: 8px 0 0 0; font-size: 11px; color: #888;">Or visit: ${acceptUrl}</p>
      </div>
    </div>
  ` : '';

  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <title>Proposal - ${quote.quote_number || quote.id.slice(0, 8)}</title>
  <style>
    @page { margin: 0.5in; size: A4; }
    body { font-family: Arial, sans-serif; color: #111; line-height: 1.5; margin: 0; padding: 0; }
    .header { background-color: #111827; padding: 24px; text-align: center; }
    .header img { height: 48px; }
    .content { padding: 32px; }
    .row { display: flex; justify-content: space-between; }
    h1 { color: #0891b2; margin: 0; }
    h2 { font-size: 12px; text-transform: uppercase; letter-spacing: 0.5px; color: #111; margin: 24px 0 8px 0; font-weight: 600; }
    .divider { border-top: 1px solid #e5e7eb; margin: 16px 0; }
    .totals { margin-top: 16px; border-top: 1px solid #e5e7eb; padding-top: 16px; }
    .totals table { width: 100%; }
    .totals td { padding: 4px 12px; }
    .total-row { background-color: #e0f2fe; font-weight: bold; font-size: 16px; }
    .terms { font-size: 13px; color: #111; }
    .terms p { margin: 4px 0; }
  </style>
</head>
<body>
  <div class="header">
    <div style="background-color: #000; display: inline-block; padding: 8px 16px; border-radius: 4px;">
      <span style="color: #fff; font-size: 24px; font-weight: bold;">EVENTPIX</span>
    </div>
  </div>
  
  <div class="content">
    <div class="row">
      <div style="font-size: 13px; color: #111;">
        <p style="margin: 0;">${settings.business_name || 'Eventpix Photography'}</p>
        <p style="margin: 0;">ABN: ${settings.business_abn || 'XX XXX XXX XXX'}</p>
        <p style="margin: 0;">${settings.business_email || 'hello@eventpix.com.au'}</p>
      </div>
      <div style="text-align: right;">
        <h1>PROPOSAL</h1>
        <p style="font-size: 16px; font-weight: 500; margin: 8px 0;">
          ${quote.quote_number || '#' + quote.id.slice(0, 8)}
          ${quoteVersion > 1 ? `<span style="color: #666;"> v${quoteVersion}</span>` : ''}
        </p>
        <p style="font-size: 13px; margin: 4px 0; color: #111;">Date: ${formatDate(quote.created_at)}</p>
        ${quote.valid_until ? `<p style="font-size: 13px; margin: 4px 0; color: #111;">Valid Until: ${formatDate(quote.valid_until)}</p>` : ''}
      </div>
    </div>

    <div class="divider"></div>

    <h2>Event Details</h2>
    <div style="font-size: 13px;">
      <p style="margin: 4px 0;"><strong style="display: inline-block; width: 100px;">Company:</strong> ${clientName || '—'}</p>
      <p style="margin: 4px 0;"><strong style="display: inline-block; width: 100px;">Contact:</strong> ${contactName || '—'}${contactEmail ? ` (${contactEmail})` : ''}</p>
      <p style="margin: 4px 0;"><strong style="display: inline-block; width: 100px;">Event Name:</strong> ${leadData?.lead_name || '—'}</p>
      <p style="margin: 4px 0;"><strong style="display: inline-block; width: 100px;">Event Date:</strong> ${formatDate(eventDate)}</p>
    </div>

    ${quote.intro_text ? `
      <h2>Introduction</h2>
      <p style="font-size: 13px; white-space: pre-wrap;">${quote.intro_text}</p>
    ` : ''}

    ${quote.scope_text ? `
      <h2>Scope of Work</h2>
      <p style="font-size: 13px; white-space: pre-wrap;">${quote.scope_text}</p>
    ` : ''}

    <h2>Services & Pricing</h2>
    ${itemsHtml}

    <div class="totals">
      <table>
        <tr>
          <td colspan="3" style="text-align: right; color: #111;">Subtotal (ex GST)</td>
          <td style="text-align: right; width: 100px; color: #111;">${formatCurrency(quote.subtotal || 0)}</td>
        </tr>
        <tr>
          <td colspan="3" style="text-align: right; color: #111;">GST (10%)</td>
          <td style="text-align: right; width: 100px; color: #111;">${formatCurrency(quote.tax_total || 0)}</td>
        </tr>
        <tr class="total-row">
          <td colspan="3" style="text-align: right;">Total (incl. GST)</td>
          <td style="text-align: right; width: 100px;">${formatCurrency(quote.total_estimate || 0)}</td>
        </tr>
      </table>
    </div>

    <h2>Terms & Conditions</h2>
    <div class="terms">
      ${quote.terms_text 
        ? `<p style="white-space: pre-wrap;">${quote.terms_text}</p>` 
        : settings.default_terms 
          ? `<p style="white-space: pre-wrap;">${settings.default_terms}</p>`
          : `<p>• A 30% deposit is required to secure your booking.</p><p>• Balance is due 7 days before the event date.</p>`
      }
    </div>

    ${quote.notes ? `
      <h2>Notes</h2>
      <p style="font-size: 13px; white-space: pre-wrap;">${quote.notes}</p>
    ` : ''}

    ${qrCodeHtml}
  </div>
</body>
</html>
  `;
}

serve(handler);
