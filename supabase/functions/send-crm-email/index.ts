import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface SendEmailRequest {
  recipientEmail: string;
  recipientName?: string;
  subject: string;
  bodyHtml: string;
  // Optional: for logging
  contactId?: string;
  clientId?: string;
  leadId?: string;
  eventId?: string;
  templateId?: string;
  // For scheduling
  scheduledEmailId?: string;
}

const handler = async (req: Request): Promise<Response> => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const resendKey = Deno.env.get("RESEND_API_KEY");
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    if (!resendKey) {
      console.error("RESEND_API_KEY not configured");
      return new Response(
        JSON.stringify({ success: false, error: "Email service not configured" }),
        { status: 500, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    // Authenticate request
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(
        JSON.stringify({ success: false, error: "Unauthorized" }),
        { status: 401, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);
    
    // Verify the JWT
    const token = authHeader.replace("Bearer ", "");
    const { data: userData, error: authError } = await supabase.auth.getUser(token);
    
    if (authError || !userData.user) {
      return new Response(
        JSON.stringify({ success: false, error: "Invalid token" }),
        { status: 401, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    const body: SendEmailRequest = await req.json();
    const {
      recipientEmail,
      recipientName,
      subject,
      bodyHtml,
      contactId,
      clientId,
      leadId,
      eventId,
      templateId,
      scheduledEmailId,
    } = body;

    // Validate required fields
    if (!recipientEmail || !subject || !bodyHtml) {
      return new Response(
        JSON.stringify({ success: false, error: "Missing required fields" }),
        { status: 400, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    console.log(`Sending CRM email to: ${recipientEmail}, subject: ${subject}`);

    // Send via Resend
    const resendResponse = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${resendKey}`,
      },
      body: JSON.stringify({
        from: "Eventpix <pix@eventpix.com.au>",
        to: [recipientEmail],
        subject: subject,
        html: bodyHtml,
      }),
    });

    const resendResult = await resendResponse.json();

    if (!resendResponse.ok) {
      console.error("Resend API error:", resendResult);
      
      // Update scheduled email status if applicable
      if (scheduledEmailId) {
        await supabase
          .from("scheduled_emails")
          .update({ 
            status: "failed", 
            error_message: resendResult.message || "Failed to send",
            updated_at: new Date().toISOString()
          })
          .eq("id", scheduledEmailId);
      }

      return new Response(
        JSON.stringify({ success: false, error: resendResult.message || "Failed to send email" }),
        { status: 500, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    console.log("Email sent successfully:", resendResult);

    // Log to email_logs
    const emailLogData: Record<string, unknown> = {
      email_type: "crm_manual",
      recipient_email: recipientEmail,
      recipient_name: recipientName || null,
      subject: subject,
      body_html: bodyHtml,
      body_preview: bodyHtml.replace(/<[^>]*>/g, "").substring(0, 200),
      status: "sent",
      sent_at: new Date().toISOString(),
      sent_by: userData.user.id,
    };

    if (contactId) emailLogData.contact_id = contactId;
    if (clientId) emailLogData.client_id = clientId;
    if (leadId) emailLogData.lead_id = leadId;
    if (eventId) emailLogData.event_id = eventId;
    if (templateId) emailLogData.template_id = templateId;

    const { error: logError } = await supabase
      .from("email_logs")
      .insert(emailLogData);

    if (logError) {
      console.error("Failed to log email:", logError);
    }

    // Log to contact_activities if we have a contact
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

    // Update scheduled email status if applicable
    if (scheduledEmailId) {
      await supabase
        .from("scheduled_emails")
        .update({ 
          status: "sent", 
          sent_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        })
        .eq("id", scheduledEmailId);
    }

    return new Response(
      JSON.stringify({ 
        success: true, 
        messageId: resendResult.id,
        message: "Email sent successfully" 
      }),
      { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders } }
    );

  } catch (error: unknown) {
    console.error("Error in send-crm-email:", error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return new Response(
      JSON.stringify({ success: false, error: errorMessage }),
      { status: 500, headers: { "Content-Type": "application/json", ...corsHeaders } }
    );
  }
};

serve(handler);
