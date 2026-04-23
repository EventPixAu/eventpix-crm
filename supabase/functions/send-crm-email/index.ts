import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface EmailAttachment {
  filename: string;
  content: string; // base64 encoded
  contentType?: string;
}

interface SendEmailRequest {
  recipientEmail: string;
  recipientName?: string;
  subject: string;
  bodyHtml: string;
  attachments?: EmailAttachment[];
  contactId?: string;
  clientId?: string;
  leadId?: string;
  eventId?: string;
  quoteId?: string;
  contractId?: string;
  templateId?: string;
  scheduledEmailId?: string;
}

async function getGmailAccessToken(): Promise<string> {
  const clientId = Deno.env.get("GMAIL_CLIENT_ID");
  const clientSecret = Deno.env.get("GMAIL_CLIENT_SECRET");
  const refreshToken = Deno.env.get("GMAIL_REFRESH_TOKEN");
  if (!clientId || !clientSecret || !refreshToken) {
    throw new Error("Gmail OAuth2 credentials not configured");
  }
  const resp = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      refresh_token: refreshToken,
      grant_type: "refresh_token",
    }),
  });
  if (!resp.ok) {
    const err = await resp.text();
    throw new Error(`Failed to refresh Gmail access token: ${err}`);
  }
  const data = await resp.json();
  return data.access_token;
}

function buildMimeMessage(
  to: string,
  subject: string,
  htmlBody: string,
  attachments?: EmailAttachment[],
): string {
  const boundary = `boundary_${crypto.randomUUID().replace(/-/g, "")}`;
  const from = '"EventPix" <pix@eventpix.com.au>';

  const headers = [
    `From: ${from}`,
    `To: ${to}`,
    `Subject: =?UTF-8?B?${btoa(unescape(encodeURIComponent(subject)))}?=`,
    "MIME-Version: 1.0",
  ];

  if (!attachments || attachments.length === 0) {
    headers.push("Content-Type: text/html; charset=UTF-8");
    headers.push("Content-Transfer-Encoding: base64");
    return headers.join("\r\n") + "\r\n\r\n" + btoa(unescape(encodeURIComponent(htmlBody)));
  }

  headers.push(`Content-Type: multipart/mixed; boundary="${boundary}"`);
  let mime = headers.join("\r\n") + "\r\n\r\n";

  // HTML part
  mime += `--${boundary}\r\n`;
  mime += "Content-Type: text/html; charset=UTF-8\r\n";
  mime += "Content-Transfer-Encoding: base64\r\n\r\n";
  mime += btoa(unescape(encodeURIComponent(htmlBody))) + "\r\n";

  // Attachments
  for (const att of attachments) {
    mime += `--${boundary}\r\n`;
    mime += `Content-Type: ${att.contentType || "application/octet-stream"}; name="${att.filename}"\r\n`;
    mime += `Content-Disposition: attachment; filename="${att.filename}"\r\n`;
    mime += "Content-Transfer-Encoding: base64\r\n\r\n";
    mime += att.content + "\r\n";
  }

  mime += `--${boundary}--`;
  return mime;
}

function base64UrlEncode(str: string): string {
  // UTF-8 safe: btoa only accepts Latin1, so encode UTF-8 bytes first
  const utf8 = unescape(encodeURIComponent(str));
  return btoa(utf8).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

async function sendViaGmailApi(
  to: string,
  subject: string,
  htmlBody: string,
  attachments?: EmailAttachment[],
): Promise<string> {
  const accessToken = await getGmailAccessToken();
  const mime = buildMimeMessage(to, subject, htmlBody, attachments);
  const raw = base64UrlEncode(mime);

  const resp = await fetch("https://gmail.googleapis.com/gmail/v1/users/me/messages/send", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ raw }),
  });

  if (!resp.ok) {
    const err = await resp.text();
    throw new Error(`Gmail API send failed: ${err}`);
  }
  const data = await resp.json();
  return data.id || "sent";
}

const handler = async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(
        JSON.stringify({ success: false, error: "Unauthorized" }),
        { status: 401, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);
    const token = authHeader.replace("Bearer ", "");
    const { data: userData, error: authError } = await supabase.auth.getUser(token);

    if (authError || !userData.user) {
      return new Response(
        JSON.stringify({ success: false, error: "Invalid token" }),
        { status: 401, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    // Server-side role check: only admin, operations, or sales may send CRM emails
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

    const body: SendEmailRequest = await req.json();
    const {
      recipientEmail, recipientName, subject, bodyHtml,
      contactId, clientId, leadId, eventId, quoteId, contractId, templateId,
      scheduledEmailId,
    } = body;

    if (!recipientEmail || !subject || !bodyHtml) {
      return new Response(
        JSON.stringify({ success: false, error: "Missing required fields" }),
        { status: 400, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    console.log(`Sending CRM email to: ${recipientEmail}, subject: ${subject}`);

    const emailFooter = `
      <div style="margin-top: 32px; padding-top: 24px; border-top: 1px solid #e5e7eb; font-family: Arial, sans-serif; font-size: 14px; color: #374151;">
        <p style="margin: 0 0 4px 0; font-weight: 600;">Trevor Connell</p>
        <p style="margin: 0 0 8px 0; color: #6b7280;">Operations Manager</p>
        <p style="margin: 0 0 4px 0;">Phone: <a href="tel:0290563775" style="color: #0891b2; text-decoration: none;">02 9056 3775</a></p>
        <p style="margin: 12px 0 0 0; font-weight: 600; color: #0891b2;">EventPix</p>
        <p style="margin: 0; font-size: 12px; color: #6b7280;">Corporate and event photography Australia-wide</p>
      </div>
    `;

    // Log to email_logs FIRST to get the ID for the tracking pixel
    const emailLogData: Record<string, unknown> = {
      email_type: "crm_manual",
      recipient_email: recipientEmail,
      recipient_name: recipientName || null,
      subject: subject,
      body_html: bodyHtml,
      body_preview: bodyHtml.replace(/<[^>]*>/g, "").substring(0, 200),
      status: "pending",
      sent_by: userData.user.id,
    };

    if (contactId) emailLogData.contact_id = contactId;
    if (clientId) emailLogData.client_id = clientId;
    if (leadId) emailLogData.lead_id = leadId;
    if (eventId) emailLogData.event_id = eventId;
    if (quoteId) emailLogData.quote_id = quoteId;
    if (contractId) emailLogData.contract_id = contractId;
    if (templateId) emailLogData.template_id = templateId;

    const { data: logData, error: logError } = await supabase
      .from("email_logs")
      .insert(emailLogData)
      .select("id")
      .single();

    if (logError) {
      console.error("Failed to log email:", logError);
    }

    // Build tracking pixel URL
    const trackingPixel = logData?.id
      ? `<img src="${supabaseUrl}/functions/v1/email-tracking-pixel?id=${logData.id}" width="1" height="1" style="display:none;" alt="" />`
      : "";

    const fullBodyHtml = bodyHtml + emailFooter + trackingPixel;
    const toAddress = recipientName ? `"${recipientName}" <${recipientEmail}>` : recipientEmail;

    // Send via Gmail API with retry logic
    let sendSuccess = false;
    let lastError: string | null = null;
    let messageId: string | null = null;
    const maxRetries = 3;

    for (let attempt = 0; attempt < maxRetries; attempt++) {
      try {
        messageId = await sendViaGmailApi(toAddress, subject, fullBodyHtml, body.attachments);
        sendSuccess = true;
        break;
      } catch (err: unknown) {
        lastError = err instanceof Error ? err.message : String(err);
        console.error(`Gmail API send attempt ${attempt + 1} failed:`, lastError);
        if (attempt < maxRetries - 1) {
          await new Promise((r) => setTimeout(r, Math.pow(2, attempt) * 1000));
        }
      }
    }

    if (!sendSuccess) {
      if (logData?.id) {
        await supabase
          .from("email_logs")
          .update({ status: "failed", error_message: lastError || "Send failed" })
          .eq("id", logData.id);
      }
      return new Response(
        JSON.stringify({ success: false, error: lastError || "Failed to send email" }),
        { status: 500, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    if (logData?.id) {
      await supabase
        .from("email_logs")
        .update({ status: "sent", sent_at: new Date().toISOString() })
        .eq("id", logData.id);
    }

    if (contactId) {
      const { error: activityError } = await supabase
        .from("contact_activities")
        .insert({
          contact_id: contactId,
          activity_type: "email",
          activity_date: new Date().toISOString(),
          subject: subject,
          notes: `Email sent to ${recipientEmail}`,
          created_by: userData.user.id,
        });
      if (activityError) {
        console.error("Failed to log contact activity:", activityError);
      }
    }

    if (scheduledEmailId) {
      await supabase
        .from("scheduled_emails")
        .update({
          status: "sent",
          sent_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq("id", scheduledEmailId);
    }

    return new Response(
      JSON.stringify({
        success: true,
        messageId,
        message: "Email sent successfully via Gmail API",
      }),
      { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders } }
    );
  } catch (error: unknown) {
    console.error("Error in send-crm-email:", error);
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    return new Response(
      JSON.stringify({ success: false, error: errorMessage }),
      { status: 500, headers: { "Content-Type": "application/json", ...corsHeaders } }
    );
  }
};

serve(handler);
