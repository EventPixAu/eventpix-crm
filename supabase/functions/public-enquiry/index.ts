/**
 * PUBLIC ENQUIRY FORM HANDLER
 * 
 * Handles public enquiry form submissions:
 * 1. Creates a new lead in the database
 * 2. Sends notification email to the sales team
 * 
 * No authentication required - uses service role key for database access
 */
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

interface EnquiryPayload {
  name: string;
  email: string;
  phone: string;
  company?: string;
  event_type_id?: string;
  event_date?: string;
  location?: string;
  budget?: string;
  lead_source?: string;
  message: string;
}

Deno.serve(async (req) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return new Response(
      JSON.stringify({ success: false, error: "Method not allowed" }),
      { status: 405, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  try {
    const payload: EnquiryPayload = await req.json();

    // Validate required fields
    if (!payload.name || !payload.email || !payload.message) {
      return new Response(
        JSON.stringify({ success: false, error: "Name, email, and message are required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Email validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(payload.email)) {
      return new Response(
        JSON.stringify({ success: false, error: "Invalid email address" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Create Supabase client with service role for public access
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Check if client already exists by company name or create new
    let clientId: string | null = null;
    
    if (payload.company) {
      // Try to find existing client by company name
      const { data: existingClient } = await supabase
        .from("clients")
        .select("id")
        .ilike("business_name", payload.company.trim())
        .limit(1)
        .maybeSingle();

      if (existingClient) {
        clientId = existingClient.id;
      } else {
        // Create new client/company
        const { data: newClient, error: clientError } = await supabase
          .from("clients")
          .insert({
            business_name: payload.company.trim(),
            primary_contact_name: payload.name.trim(),
            primary_contact_email: payload.email.trim(),
            primary_contact_phone: payload.phone?.trim() || null,
            lead_source: "Website Enquiry",
            status: "prospect",
          })
          .select("id")
          .single();

        if (clientError) {
          console.error("Error creating client:", clientError);
        } else {
          clientId = newClient.id;
        }
      }
    }

    // Parse lead source from form option to lead_source_id
    let leadSourceId: string | null = null;
    if (payload.lead_source) {
      const { data: sourceData } = await supabase
        .from("lead_sources")
        .select("id")
        .ilike("name", payload.lead_source.trim())
        .limit(1)
        .maybeSingle();
      
      if (sourceData) {
        leadSourceId = sourceData.id;
      }
    }

    // Create the lead
    const leadName = payload.company 
      ? `${payload.company} - Web Enquiry`
      : `${payload.name} - Web Enquiry`;

    const { data: lead, error: leadError } = await supabase
      .from("leads")
      .insert({
        lead_name: leadName,
        client_id: clientId,
        event_type_id: payload.event_type_id || null,
        estimated_event_date: payload.event_date || null,
        venue_text: payload.location?.trim() || null,
        budget_range: payload.budget?.trim() || null,
        lead_source_id: leadSourceId,
        source: "Website",
        requirements_summary: payload.message.trim(),
        notes: `Web enquiry from: ${payload.name}\nEmail: ${payload.email}\nPhone: ${payload.phone || "Not provided"}\n\n${payload.message}`,
        status: "new",
      })
      .select("id")
      .single();

    if (leadError) {
      console.error("Error creating lead:", leadError);
      return new Response(
        JSON.stringify({ success: false, error: "Failed to submit enquiry" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Create contact for the lead if we have a client
    if (clientId) {
      // Check if contact already exists
      const { data: existingContact } = await supabase
        .from("client_contacts")
        .select("id")
        .eq("client_id", clientId)
        .ilike("email", payload.email.trim())
        .limit(1)
        .maybeSingle();

      let contactId = existingContact?.id;

      if (!existingContact) {
        // Create new contact
        const nameParts = payload.name.trim().split(" ");
        const firstName = nameParts[0] || "";
        const lastName = nameParts.slice(1).join(" ") || "";

        const { data: newContact } = await supabase
          .from("client_contacts")
          .insert({
            client_id: clientId,
            contact_name: payload.name.trim(),
            first_name: firstName,
            last_name: lastName,
            email: payload.email.trim(),
            phone: payload.phone?.trim() || null,
            is_primary: true,
          })
          .select("id")
          .single();

        contactId = newContact?.id;
      }

      // Link contact to lead via enquiry_contacts
      if (contactId) {
        await supabase
          .from("enquiry_contacts")
          .insert({
            lead_id: lead.id,
            contact_id: contactId,
            role: "primary",
            contact_name: payload.name.trim(),
            contact_email: payload.email.trim(),
            contact_phone: payload.phone?.trim() || null,
          });
      }
    }

    // Send notification email
    const resendApiKey = Deno.env.get("RESEND_API_KEY");
    if (resendApiKey) {
      const notificationHtml = `
        <h2>New Website Enquiry</h2>
        <table style="border-collapse: collapse; width: 100%; max-width: 600px;">
          <tr>
            <td style="padding: 8px; border: 1px solid #ddd; font-weight: bold;">Name</td>
            <td style="padding: 8px; border: 1px solid #ddd;">${escapeHtml(payload.name)}</td>
          </tr>
          <tr>
            <td style="padding: 8px; border: 1px solid #ddd; font-weight: bold;">Email</td>
            <td style="padding: 8px; border: 1px solid #ddd;"><a href="mailto:${escapeHtml(payload.email)}">${escapeHtml(payload.email)}</a></td>
          </tr>
          <tr>
            <td style="padding: 8px; border: 1px solid #ddd; font-weight: bold;">Phone</td>
            <td style="padding: 8px; border: 1px solid #ddd;">${escapeHtml(payload.phone || "Not provided")}</td>
          </tr>
          ${payload.company ? `
          <tr>
            <td style="padding: 8px; border: 1px solid #ddd; font-weight: bold;">Company</td>
            <td style="padding: 8px; border: 1px solid #ddd;">${escapeHtml(payload.company)}</td>
          </tr>
          ` : ""}
          ${payload.event_date ? `
          <tr>
            <td style="padding: 8px; border: 1px solid #ddd; font-weight: bold;">Event Date</td>
            <td style="padding: 8px; border: 1px solid #ddd;">${escapeHtml(payload.event_date)}</td>
          </tr>
          ` : ""}
          ${payload.location ? `
          <tr>
            <td style="padding: 8px; border: 1px solid #ddd; font-weight: bold;">Location</td>
            <td style="padding: 8px; border: 1px solid #ddd;">${escapeHtml(payload.location)}</td>
          </tr>
          ` : ""}
          ${payload.budget ? `
          <tr>
            <td style="padding: 8px; border: 1px solid #ddd; font-weight: bold;">Budget</td>
            <td style="padding: 8px; border: 1px solid #ddd;">${escapeHtml(payload.budget)}</td>
          </tr>
          ` : ""}
          ${payload.lead_source ? `
          <tr>
            <td style="padding: 8px; border: 1px solid #ddd; font-weight: bold;">How they heard about us</td>
            <td style="padding: 8px; border: 1px solid #ddd;">${escapeHtml(payload.lead_source)}</td>
          </tr>
          ` : ""}
        </table>
        <h3>Message</h3>
        <p style="background: #f5f5f5; padding: 15px; border-radius: 4px; white-space: pre-wrap;">${escapeHtml(payload.message)}</p>
        <hr style="margin: 20px 0; border: none; border-top: 1px solid #ddd;">
        <p style="color: #666; font-size: 12px;">
          This lead has been automatically created in the CRM. 
          <a href="https://app.eventpix.com.au/sales/leads/${lead.id}">View Lead →</a>
        </p>
      `;

      try {
        const emailResponse = await fetch("https://api.resend.com/emails", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${resendApiKey}`,
          },
          body: JSON.stringify({
            from: "EventPix <pix@rs.eventpix.com.au>",
            to: ["pix@eventpix.com.au"],
            subject: `New Website Enquiry: ${payload.company || payload.name}`,
            html: notificationHtml,
          }),
        });

        const emailResult = await emailResponse.json();
        if (!emailResponse.ok) {
          console.error("Email notification failed:", emailResult);
        } else {
          console.log("Notification email sent:", emailResult.id);
        }
      } catch (emailError) {
        console.error("Error sending notification email:", emailError);
        // Don't fail the request if email fails
      }
    } else {
      console.warn("RESEND_API_KEY not configured, skipping notification email");
    }

    return new Response(
      JSON.stringify({ 
        success: true, 
        message: "Thank you for your enquiry. We'll be in touch soon!" 
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error) {
    console.error("Error processing enquiry:", error);
    return new Response(
      JSON.stringify({ success: false, error: "An unexpected error occurred" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}
