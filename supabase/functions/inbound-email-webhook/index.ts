import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

interface ResendInboundEmail {
  from: string;
  to: string;
  subject: string;
  text?: string;
  html?: string;
  headers?: Record<string, string>;
  created_at?: string;
}

const handler = async (req: Request): Promise<Response> => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const body: ResendInboundEmail = await req.json();
    console.log("Received inbound email webhook:", JSON.stringify(body, null, 2));

    const { from, to, subject, text, html, headers } = body;

    // Parse sender email and name
    const fromMatch = from.match(/^(?:(.+?)\s*<)?([^<>]+)>?$/);
    const fromName = fromMatch?.[1]?.trim() || null;
    const fromEmail = fromMatch?.[2]?.trim().toLowerCase() || from.toLowerCase();

    // Parse recipient email
    const toMatch = to.match(/^(?:(.+?)\s*<)?([^<>]+)>?$/);
    const toEmail = toMatch?.[2]?.trim().toLowerCase() || to.toLowerCase();

    console.log(`Inbound email from: ${fromEmail} (${fromName}) to: ${toEmail}`);

    // Try to find the contact by email
    const { data: contact } = await supabase
      .from("client_contacts")
      .select("id, client_id")
      .ilike("email", fromEmail)
      .maybeSingle();

    // Try to find the original outbound email this is replying to
    // Look for recent emails TO this sender
    let inReplyToId: string | null = null;
    const { data: originalEmail } = await supabase
      .from("email_logs")
      .select("id, event_id, lead_id, client_id, contact_id")
      .ilike("recipient_email", fromEmail)
      .eq("direction", "outbound")
      .order("sent_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (originalEmail) {
      inReplyToId = originalEmail.id;
      console.log(`Found original email to reply to: ${inReplyToId}`);
    }

    // Create body preview from text or stripped HTML
    const bodyPreview = text 
      ? text.substring(0, 200) 
      : html?.replace(/<[^>]*>/g, "").substring(0, 200) || null;

    // Log the inbound email
    const emailLogData: Record<string, unknown> = {
      email_type: "inbound_reply",
      direction: "inbound",
      from_email: fromEmail,
      from_name: fromName,
      recipient_email: toEmail,
      subject: subject || "(No Subject)",
      body_html: html || null,
      body_preview: bodyPreview,
      status: "received",
      sent_at: new Date().toISOString(),
      in_reply_to: inReplyToId,
      // Link to related entities from original email if found
      contact_id: contact?.id || originalEmail?.contact_id || null,
      client_id: contact?.client_id || originalEmail?.client_id || null,
      event_id: originalEmail?.event_id || null,
      lead_id: originalEmail?.lead_id || null,
    };

    const { data: emailLog, error: logError } = await supabase
      .from("email_logs")
      .insert(emailLogData)
      .select()
      .single();

    if (logError) {
      console.error("Failed to log inbound email:", logError);
      return new Response(
        JSON.stringify({ success: false, error: logError.message }),
        { status: 500, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    console.log("Inbound email logged successfully:", emailLog.id);

    // Log to contact_activities if we have a contact
    if (emailLogData.contact_id) {
      const { error: activityError } = await supabase
        .from("contact_activities")
        .insert({
          contact_id: emailLogData.contact_id,
          activity_type: "email",
          activity_date: new Date().toISOString(),
          subject: `Reply: ${subject}`,
          notes: `Inbound email received from ${fromEmail}`,
        });

      if (activityError) {
        console.error("Failed to log contact activity:", activityError);
      }
    }

    return new Response(
      JSON.stringify({ success: true, email_log_id: emailLog.id }),
      { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders } }
    );

  } catch (error: unknown) {
    console.error("Error in inbound-email-webhook:", error);
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    return new Response(
      JSON.stringify({ success: false, error: errorMessage }),
      { status: 500, headers: { "Content-Type": "application/json", ...corsHeaders } }
    );
  }
};

serve(handler);
