import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface SendQuoteAcceptanceEmailRequest {
  quoteId: string;
  acceptedByName: string;
  acceptedByEmail: string;
}

async function getGmailAccessToken(): Promise<string> {
  const clientId = Deno.env.get("GMAIL_CLIENT_ID");
  const clientSecret = Deno.env.get("GMAIL_CLIENT_SECRET");
  const refreshToken = Deno.env.get("GMAIL_REFRESH_TOKEN");
  if (!clientId || !clientSecret || !refreshToken) throw new Error("Gmail OAuth2 credentials not configured");
  const resp = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ client_id: clientId, client_secret: clientSecret, refresh_token: refreshToken, grant_type: "refresh_token" }),
  });
  if (!resp.ok) throw new Error(`Token refresh failed: ${await resp.text()}`);
  return (await resp.json()).access_token;
}

async function sendViaGmailApi(to: string, subject: string, html: string): Promise<void> {
  const accessToken = await getGmailAccessToken();
  const from = '"EventPix" <pix@eventpix.com.au>';
  const encodedSubject = `=?UTF-8?B?${btoa(unescape(encodeURIComponent(subject)))}?=`;
  const mime = `From: ${from}\r\nTo: ${to}\r\nSubject: ${encodedSubject}\r\nMIME-Version: 1.0\r\nContent-Type: text/html; charset=UTF-8\r\nContent-Transfer-Encoding: base64\r\n\r\n${btoa(unescape(encodeURIComponent(html)))}`;
  const raw = btoa(mime).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
  const resp = await fetch("https://gmail.googleapis.com/gmail/v1/users/me/messages/send", {
    method: "POST", headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" },
    body: JSON.stringify({ raw }),
  });
  if (!resp.ok) throw new Error(`Gmail API error: ${await resp.text()}`);
}

const handler = async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    const body: SendQuoteAcceptanceEmailRequest = await req.json();
    const { quoteId, acceptedByName, acceptedByEmail } = body;

    if (!quoteId || !acceptedByName || !acceptedByEmail) {
      return new Response(JSON.stringify({ success: false, error: "Missing required fields" }), { status: 400, headers: { "Content-Type": "application/json", ...corsHeaders } });
    }

    console.log(`Sending quote acceptance emails for quote: ${quoteId}`);

    const { data: quote, error: quoteError } = await supabase
      .from("quotes").select("id, quote_number, total_estimate, subtotal, tax_total, accepted_at, lead_id, client_id").eq("id", quoteId).single();
    if (quoteError || !quote) {
      return new Response(JSON.stringify({ success: false, error: "Quote not found" }), { status: 404, headers: { "Content-Type": "application/json", ...corsHeaders } });
    }

    let leadData: any = null, clientData: any = null;
    if (quote.lead_id) {
      const { data: lead } = await supabase.from("leads").select("id, lead_name, client_id").eq("id", quote.lead_id).single();
      leadData = lead;
      if (lead?.client_id) {
        const { data: client } = await supabase.from("clients").select("id, business_name, primary_contact_name, primary_contact_email").eq("id", lead.client_id).single();
        clientData = client;
      }
    }
    if (quote.client_id && !clientData) {
      const { data: client } = await supabase.from("clients").select("id, business_name, primary_contact_name, primary_contact_email").eq("id", quote.client_id).single();
      clientData = client;
    }

    const clientName = clientData?.business_name || leadData?.lead_name || "Unknown Client";
    const leadName = leadData?.lead_name || clientName;
    const quoteNumber = quote.quote_number || `#${quote.id.slice(0, 8)}`;
    const totalFormatted = new Intl.NumberFormat("en-AU", { style: "currency", currency: "AUD" }).format(quote.total_estimate || 0);

    const emailFooter = `<div style="margin-top:32px;padding-top:24px;border-top:1px solid #e5e7eb;font-family:Arial,sans-serif;font-size:14px;color:#374151;">
      <p style="margin:0 0 4px 0;font-weight:600;">Trevor Connell</p><p style="margin:0 0 8px 0;color:#6b7280;">Operations Manager</p>
      <p style="margin:0 0 4px 0;">Phone: <a href="tel:0290563775" style="color:#0891b2;text-decoration:none;">02 9056 3775</a></p>
      <p style="margin:12px 0 0 0;font-weight:600;color:#0891b2;">EventPix</p>
      <p style="margin:0;font-size:12px;color:#6b7280;">Corporate and event photography Australia-wide</p></div>`;

    const clientEmailHtml = `<div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;">
      <div style="background-color:#111827;padding:20px;text-align:center;border-radius:8px 8px 0 0;"><h1 style="color:white;margin:0;font-size:24px;">EventPix</h1></div>
      <div style="padding:32px;background-color:#ffffff;">
        <h2 style="color:#111827;margin-top:0;">Thank you for accepting our proposal!</h2>
        <p style="color:#374151;font-size:16px;">Hi ${acceptedByName},</p>
        <p style="color:#374151;font-size:16px;">Thank you for accepting our proposal for <strong>${leadName}</strong>. We're excited to work with you!</p>
        <div style="background-color:#f3f4f6;padding:20px;border-radius:8px;margin:24px 0;">
          <p style="margin:0 0 8px 0;color:#6b7280;">Quote Reference</p><p style="margin:0;font-weight:bold;color:#111827;font-size:18px;">${quoteNumber}</p>
          <p style="margin:16px 0 0 0;color:#6b7280;">Total Amount</p><p style="margin:0;font-weight:bold;color:#0891b2;font-size:24px;">${totalFormatted}</p>
        </div>
        <p style="color:#374151;font-size:16px;">Our team will be in touch shortly to discuss the next steps.</p>
      </div>${emailFooter}</div>`;

    const internalEmailHtml = `<div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;">
      <div style="background-color:#059669;padding:20px;text-align:center;border-radius:8px 8px 0 0;"><h1 style="color:white;margin:0;font-size:24px;">🎉 Quote Accepted!</h1></div>
      <div style="padding:32px;background-color:#ffffff;">
        <p style="color:#374151;font-size:16px;margin-top:0;">Great news! A client has accepted a proposal.</p>
        <div style="background-color:#f3f4f6;padding:20px;border-radius:8px;margin:24px 0;">
          <table style="width:100%;border-collapse:collapse;">
            <tr><td style="padding:8px 0;color:#6b7280;">Client</td><td style="padding:8px 0;color:#111827;font-weight:bold;text-align:right;">${clientName}</td></tr>
            <tr><td style="padding:8px 0;color:#6b7280;">Job</td><td style="padding:8px 0;color:#111827;font-weight:bold;text-align:right;">${leadName}</td></tr>
            <tr><td style="padding:8px 0;color:#6b7280;">Quote</td><td style="padding:8px 0;color:#111827;font-weight:bold;text-align:right;">${quoteNumber}</td></tr>
            <tr><td style="padding:8px 0;color:#6b7280;">Value</td><td style="padding:8px 0;color:#059669;font-weight:bold;font-size:18px;text-align:right;">${totalFormatted}</td></tr>
          </table>
        </div>
        <div style="background-color:#ecfdf5;padding:16px;border-radius:8px;border-left:4px solid #059669;">
          <p style="margin:0 0 4px 0;color:#065f46;font-weight:bold;">Accepted by</p>
          <p style="margin:0;color:#047857;">${acceptedByName}</p><p style="margin:4px 0 0 0;color:#047857;">${acceptedByEmail}</p>
        </div>
      </div></div>`;

    let clientSuccess = false;
    try {
      await sendViaGmailApi(acceptedByEmail, `Thank you for your booking confirmation - ${leadName}`, clientEmailHtml);
      clientSuccess = true;
      console.log(`Client confirmation sent to: ${acceptedByEmail}`);
      await supabase.from("email_logs").insert({
        email_type: "quote_acceptance_confirmation", recipient_email: acceptedByEmail, recipient_name: acceptedByName,
        subject: `Thank you for your booking confirmation - ${leadName}`, body_preview: `Thank you for accepting our proposal for ${leadName}.`,
        status: "sent", sent_at: new Date().toISOString(), quote_id: quoteId, client_id: quote.client_id || leadData?.client_id, lead_id: quote.lead_id,
      });
    } catch (err) { console.error("Failed to send client email:", err); }

    let internalSuccess = false;
    try {
      await sendViaGmailApi("pix@eventpix.com.au", `🎉 Quote Accepted: ${clientName} - ${leadName} (${totalFormatted})`, internalEmailHtml);
      internalSuccess = true;
      console.log("Internal notification sent");
      await supabase.from("email_logs").insert({
        email_type: "quote_acceptance_internal", recipient_email: "pix@eventpix.com.au", recipient_name: "EventPix Team",
        subject: `🎉 Quote Accepted: ${clientName} - ${leadName}`, body_preview: `Quote ${quoteNumber} accepted by ${acceptedByName} for ${totalFormatted}`,
        status: "sent", sent_at: new Date().toISOString(), quote_id: quoteId, client_id: quote.client_id || leadData?.client_id, lead_id: quote.lead_id,
      });
    } catch (err) { console.error("Failed to send internal email:", err); }

    return new Response(JSON.stringify({ success: true, clientEmailSent: clientSuccess, internalEmailSent: internalSuccess }), { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders } });
  } catch (error: unknown) {
    console.error("Error in send-quote-acceptance-email:", error);
    return new Response(JSON.stringify({ success: false, error: error instanceof Error ? error.message : "Unknown error" }), { status: 500, headers: { "Content-Type": "application/json", ...corsHeaders } });
  }
};

serve(handler);
