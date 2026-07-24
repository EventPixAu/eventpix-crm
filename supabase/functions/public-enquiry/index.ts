/**
 * PUBLIC ENQUIRY FORM HANDLER
 *
 * Handles public enquiry form submissions:
 * 1. Looks up or creates a CRM contact (by email)
 * 2. Links/creates a company (if provided) and associates it
 * 3. Creates a new Lead in the Sales Dashboard
 * 4. Logs an activity entry on the contact's timeline
 * 5. Sends internal notification email + auto-response
 *
 * No authentication required - uses service role key for database access.
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
  website?: string; // honeypot — must remain empty for real users
}

async function sha256Hex(input: string): Promise<string> {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(input));
  return Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, "0")).join("");
}

// Statuses considered "higher" than Prospect — don't overwrite
const HIGHER_STATUSES = new Set(["Active", "Current", "Staff"]);

Deno.serve(async (req) => {
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

    if (!payload.name || !payload.email || !payload.message) {
      return new Response(
        JSON.stringify({ success: false, error: "Name, email, and message are required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(payload.email)) {
      return new Response(
        JSON.stringify({ success: false, error: "Invalid email address" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const emailNormalised = payload.email.trim();
    const phoneNormalised = payload.phone?.trim() || null;
    const companyNormalised = payload.company?.trim() || null;

    // ─── 1. Resolve / create COMPANY ───────────────────────────────────────────
    let clientId: string | null = null;
    if (companyNormalised) {
      const { data: existingClient } = await supabase
        .from("clients")
        .select("id")
        .ilike("business_name", companyNormalised)
        .limit(1)
        .maybeSingle();

      if (existingClient) {
        clientId = existingClient.id;
      } else {
        const { data: newClient, error: clientError } = await supabase
          .from("clients")
          .insert({
            business_name: companyNormalised,
            primary_contact_name: payload.name.trim(),
            primary_contact_email: emailNormalised,
            primary_contact_phone: phoneNormalised,
            lead_source: "Website Enquiry",
            status: "prospect",
          })
          .select("id")
          .maybeSingle();

        if (clientError) {
          console.error("Error creating client:", clientError);
        } else if (newClient) {
          clientId = newClient.id;
        }
      }
    }

    // ─── 2. Lookup or create CONTACT (by email, globally) ──────────────────────
    const nameParts = payload.name.trim().split(/\s+/);
    const firstName = nameParts[0] || "";
    const lastName = nameParts.slice(1).join(" ") || "";

    let contactId: string | null = null;
    let contactIsNew = false;

    const { data: existingContact } = await supabase
      .from("client_contacts")
      .select("id, phone, phone_mobile, client_id, status, first_name, last_name")
      .ilike("email", emailNormalised)
      .limit(1)
      .maybeSingle();

    if (existingContact) {
      contactId = existingContact.id;

      // Update blank fields only — do not overwrite existing values
      const updates: Record<string, unknown> = {};
      if (!existingContact.phone && !existingContact.phone_mobile && phoneNormalised) {
        updates.phone = phoneNormalised;
      }
      if (!existingContact.client_id && clientId) {
        updates.client_id = clientId;
      }
      if (!existingContact.first_name && firstName) updates.first_name = firstName;
      if (!existingContact.last_name && lastName) updates.last_name = lastName;
      if (
        !existingContact.status ||
        (existingContact.status !== "Prospect" && !HIGHER_STATUSES.has(existingContact.status))
      ) {
        // leave alone if higher; otherwise no change (keep what's there)
      }

      if (Object.keys(updates).length > 0) {
        await supabase.from("client_contacts").update(updates).eq("id", contactId);
      }
    } else {
      contactIsNew = true;
      const { data: newContact, error: contactError } = await supabase
        .from("client_contacts")
        .insert({
          client_id: clientId,
          contact_name: payload.name.trim(),
          first_name: firstName,
          last_name: lastName,
          email: emailNormalised,
          phone: phoneNormalised,
          source: "Website Enquiry",
          status: "Prospect",
          is_primary: !!clientId,
        })
        .select("id")
        .maybeSingle();

      if (contactError) {
        console.error("Error creating contact:", contactError);
      } else if (newContact) {
        contactId = newContact.id;
      }
    }

    // Ensure contact↔company association exists
    if (contactId && clientId) {
      const { data: existingAssoc } = await supabase
        .from("contact_company_associations")
        .select("id")
        .eq("contact_id", contactId)
        .eq("company_id", clientId)
        .maybeSingle();

      if (!existingAssoc) {
        await supabase.from("contact_company_associations").insert({
          contact_id: contactId,
          company_id: clientId,
          is_primary: contactIsNew,
          is_active: true,
        });
      }
    }

    // ─── 3. Resolve lookup IDs (lead source + event type name) ─────────────────
    // The "How did you hear about us?" maps to lead_source_id
    let leadSourceId: string | null = null;
    if (payload.lead_source) {
      const { data: sourceData } = await supabase
        .from("lead_sources")
        .select("id")
        .ilike("name", payload.lead_source.trim())
        .limit(1)
        .maybeSingle();
      if (sourceData) leadSourceId = sourceData.id;
    }
    // Fallback to "Website" if none matched
    if (!leadSourceId) {
      const { data: websiteSource } = await supabase
        .from("lead_sources")
        .select("id")
        .ilike("name", "Website")
        .limit(1)
        .maybeSingle();
      if (websiteSource) leadSourceId = websiteSource.id;
    }

    let eventTypeName: string | null = null;
    if (payload.event_type_id) {
      const { data: eventType } = await supabase
        .from("event_types")
        .select("name")
        .eq("id", payload.event_type_id)
        .maybeSingle();
      if (eventType) eventTypeName = eventType.name;
    }

    // ─── 4. Create the LEAD ────────────────────────────────────────────────────
    const titleLeft = eventTypeName || "Web Enquiry";
    const titleRight = companyNormalised || payload.name.trim();
    const leadName = `${titleLeft} — ${titleRight}`;

    const budgetAmount = parseBudgetAmount(payload.budget);
    const budgetNote = payload.budget?.trim() ? `\nBudget Range: ${payload.budget.trim()}` : "";

    const { data: lead, error: leadError } = await supabase
      .from("leads")
      .insert({
        lead_name: leadName,
        client_id: clientId,
        event_type_id: payload.event_type_id || null,
        estimated_event_date: payload.event_date || null,
        venue_text: payload.location?.trim() || null,
        budget: budgetAmount,
        lead_source_id: leadSourceId,
        source: "Website Enquiry",
        requirements_summary: payload.message.trim(),
        notes: `Web enquiry from: ${payload.name}\nEmail: ${emailNormalised}\nPhone: ${phoneNormalised || "Not provided"}${budgetNote}\n\n${payload.message}`,
        status: "new",
      })
      .select("id")
      .maybeSingle();

    if (leadError || !lead) {
      console.error("Error creating lead:", leadError);
      return new Response(
        JSON.stringify({ success: false, error: "Failed to submit enquiry" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Link contact to lead via enquiry_contacts
    if (contactId) {
      await supabase.from("enquiry_contacts").insert({
        lead_id: lead.id,
        contact_id: contactId,
        role: "primary",
        contact_name: payload.name.trim(),
        contact_email: emailNormalised,
        contact_phone: phoneNormalised,
      });
    }

    // ─── 4b. Add note to lead's Notes panel ─────────────────────────────────
    await supabase.from("lead_notes").insert({
      lead_id: lead.id,
      content: payload.message.trim(),
    });

    // ─── 4c. Auto-create an event session with submitted details ───────────
    if (payload.event_date) {
      const { error: sessionError } = await supabase.from("event_sessions").insert({
        lead_id: lead.id,
        session_date: payload.event_date,
        session_type: "live",
        label: eventTypeName || null,
        venue_name: payload.location?.trim() || null,
        venue_address: payload.location?.trim() || null,
        timezone: guessTimezoneFromLocation(payload.location),
        sort_order: 0,
      });
      if (sessionError) console.error("Error creating event session:", sessionError);
    }

    // ─── 5. Activity log entry on the contact's timeline ───────────────────────
    if (contactId) {
      const dateStr = new Date().toLocaleDateString("en-AU", {
        day: "numeric", month: "short", year: "numeric",
      });
      const eventDateStr = payload.event_date
        ? new Date(payload.event_date).toLocaleDateString("en-AU", {
            day: "numeric", month: "short", year: "numeric",
          })
        : "TBC";
      const subject = `Website enquiry received on ${dateStr} — ${eventTypeName || "Enquiry"} on ${eventDateStr}`;

      await supabase.from("contact_activities").insert({
        contact_id: contactId,
        activity_type: "system",
        subject,
        notes: payload.message.trim(),
      });
    }

    // ─── 6. Notification email ─────────────────────────────────────────────────
    const leadUrl = `https://app.eventpix.com.au/sales/leads/${lead.id}`;
    const contactStatusLabel = contactIsNew
      ? '<span style="color:#0a7d34;font-weight:bold;">New contact created in CRM</span>'
      : '<span style="color:#1f4ec7;font-weight:bold;">Existing CRM contact matched</span>';

    const resendApiKey = Deno.env.get("RESEND_API_KEY");
    if (resendApiKey) {
      const notificationHtml = `
        <h2>New Website Enquiry</h2>
        <p>${contactStatusLabel}</p>
        <table style="border-collapse: collapse; width: 100%; max-width: 600px;">
          <tr><td style="padding:8px;border:1px solid #ddd;font-weight:bold;">Name</td><td style="padding:8px;border:1px solid #ddd;">${escapeHtml(payload.name)}</td></tr>
          <tr><td style="padding:8px;border:1px solid #ddd;font-weight:bold;">Email</td><td style="padding:8px;border:1px solid #ddd;"><a href="mailto:${escapeHtml(emailNormalised)}">${escapeHtml(emailNormalised)}</a></td></tr>
          <tr><td style="padding:8px;border:1px solid #ddd;font-weight:bold;">Phone</td><td style="padding:8px;border:1px solid #ddd;">${escapeHtml(payload.phone || "Not provided")}</td></tr>
          ${companyNormalised ? `<tr><td style="padding:8px;border:1px solid #ddd;font-weight:bold;">Company</td><td style="padding:8px;border:1px solid #ddd;">${escapeHtml(companyNormalised)}</td></tr>` : ""}
          ${eventTypeName ? `<tr><td style="padding:8px;border:1px solid #ddd;font-weight:bold;">Event Type</td><td style="padding:8px;border:1px solid #ddd;">${escapeHtml(eventTypeName)}</td></tr>` : ""}
          ${payload.event_date ? `<tr><td style="padding:8px;border:1px solid #ddd;font-weight:bold;">Event Date</td><td style="padding:8px;border:1px solid #ddd;">${escapeHtml(payload.event_date)}</td></tr>` : ""}
          ${payload.location ? `<tr><td style="padding:8px;border:1px solid #ddd;font-weight:bold;">Location</td><td style="padding:8px;border:1px solid #ddd;">${escapeHtml(payload.location)}</td></tr>` : ""}
          ${payload.budget ? `<tr><td style="padding:8px;border:1px solid #ddd;font-weight:bold;">Budget</td><td style="padding:8px;border:1px solid #ddd;">${escapeHtml(payload.budget)}</td></tr>` : ""}
          ${payload.lead_source ? `<tr><td style="padding:8px;border:1px solid #ddd;font-weight:bold;">How they heard about us</td><td style="padding:8px;border:1px solid #ddd;">${escapeHtml(payload.lead_source)}</td></tr>` : ""}
        </table>
        <h3>Message</h3>
        <p style="background:#f5f5f5;padding:15px;border-radius:4px;white-space:pre-wrap;">${escapeHtml(payload.message)}</p>
        <p style="margin:20px 0;">
          <a href="${leadUrl}" style="display:inline-block;background:#111;color:#fff;padding:10px 18px;border-radius:6px;text-decoration:none;font-weight:bold;">Open Lead in Sales Dashboard →</a>
        </p>
        <hr style="margin:20px 0;border:none;border-top:1px solid #ddd;">
        <p style="color:#666;font-size:12px;">
          ${contactIsNew ? "A new contact was created" : "Linked to an existing contact"} and a new lead has been added to the Sales Dashboard.<br>
          <a href="${leadUrl}">${leadUrl}</a>
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
            subject: `New Website Enquiry: ${companyNormalised || payload.name}`,
            html: notificationHtml,
          }),
        });
        const emailResult = await emailResponse.json();
        if (!emailResponse.ok) console.error("Email notification failed:", emailResult);
        else console.log("Notification email sent:", emailResult.id);
      } catch (emailError) {
        console.error("Error sending notification email:", emailError);
      }

      // Auto-response to enquirer
      try {
        const { data: autoReplyTemplate } = await supabase
          .from("email_templates")
          .select("*")
          .eq("trigger_type", "enquiry_received")
          .eq("is_active", true)
          .limit(1)
          .maybeSingle();

        if (autoReplyTemplate) {
          const mergeContext: Record<string, string> = {
            "{{contact.first_name}}": firstName || "there",
            "{{contact.name}}": payload.name,
            "{{client.primary_contact_name}}": payload.name,
            "{{lead_or_job_name}}": leadName,
            "{{company_name}}": companyNormalised || "",
            "{{event_date}}": payload.event_date || "TBC",
          };

          let subject = autoReplyTemplate.subject;
          let body = autoReplyTemplate.body_text || autoReplyTemplate.body_html;
          for (const [key, value] of Object.entries(mergeContext)) {
            subject = subject.replace(new RegExp(key.replace(/[{}]/g, "\\$&"), "g"), value);
            body = body.replace(new RegExp(key.replace(/[{}]/g, "\\$&"), "g"), value);
          }

          const bodyHtml = autoReplyTemplate.format === "text"
            ? `<div style="font-family:Arial,sans-serif;font-size:14px;line-height:1.6;">${body.replace(/\n/g, "<br>")}</div>`
            : body;

          const footer = `
            <hr style="margin:20px 0;border:none;border-top:1px solid #ddd;">
            <p style="color:#666;font-size:12px;">
              Trevor Connell, Operations Manager<br>
              Phone: 02 9056 3775<br>
              EventPix corporate and event photography Australia-wide
            </p>`;

          const autoReplyResponse = await fetch("https://api.resend.com/emails", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${resendApiKey}`,
            },
            body: JSON.stringify({
              from: "EventPix <pix@rs.eventpix.com.au>",
              to: [emailNormalised],
              subject,
              html: bodyHtml + footer,
            }),
          });

          const autoReplyResult = await autoReplyResponse.json();
          if (!autoReplyResponse.ok) {
            console.error("Auto-response email failed:", autoReplyResult);
          } else {
            await supabase.from("email_logs").insert({
              email_type: "enquiry_auto_response",
              recipient_email: emailNormalised,
              recipient_name: payload.name,
              subject,
              body_html: bodyHtml,
              lead_id: lead.id,
              client_id: clientId,
              contact_id: contactId,
              template_id: autoReplyTemplate.id,
              status: "sent",
              sent_at: new Date().toISOString(),
            });
          }
        }
      } catch (autoReplyError) {
        console.error("Error sending auto-response email:", autoReplyError);
      }
    } else {
      console.warn("RESEND_API_KEY not configured, skipping emails");
    }

    return new Response(
      JSON.stringify({
        success: true,
        message: "Thank you for your enquiry. We'll be in touch soon!",
        lead_id: lead.id,
        contact_id: contactId,
        contact_is_new: contactIsNew,
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

function parseBudgetAmount(budget?: string): number | null {
  if (!budget?.trim()) return null;
  const match = budget.match(/[\d,]+/);
  if (!match) return null;
  const amount = Number(match[0].replace(/,/g, ""));
  return Number.isFinite(amount) ? amount : null;
}

/**
 * Guess an IANA timezone from a free-text Australian location string.
 * Matches state codes/names and major cities. Falls back to Sydney.
 */
function guessTimezoneFromLocation(location?: string | null): string {
  const DEFAULT_TZ = "Australia/Sydney";
  if (!location) return DEFAULT_TZ;
  const s = location.toLowerCase();

  // City matches first (more specific)
  const cityMap: Array<[RegExp, string]> = [
    [/\bperth\b|\bfremantle\b|\bmandurah\b/, "Australia/Perth"],
    [/\badelaide\b/, "Australia/Adelaide"],
    [/\bdarwin\b|\balice springs\b|\bkatherine\b/, "Australia/Darwin"],
    [/\bbrisbane\b|\bgold coast\b|\bsunshine coast\b|\bcairns\b|\btownsville\b|\btoowoomba\b/, "Australia/Brisbane"],
    [/\bhobart\b|\blaunceston\b/, "Australia/Hobart"],
    [/\bmelbourne\b|\bgeelong\b|\bballarat\b|\bbendigo\b/, "Australia/Melbourne"],
    [/\bsydney\b|\bnewcastle\b|\bwollongong\b|\bcentral coast\b/, "Australia/Sydney"],
    [/\bcanberra\b/, "Australia/Sydney"],
  ];
  for (const [re, tz] of cityMap) if (re.test(s)) return tz;

  // State matches
  const stateMap: Array<[RegExp, string]> = [
    [/\b(wa|western australia)\b/, "Australia/Perth"],
    [/\b(sa|south australia)\b/, "Australia/Adelaide"],
    [/\b(nt|northern territory)\b/, "Australia/Darwin"],
    [/\b(qld|queensland)\b/, "Australia/Brisbane"],
    [/\b(tas|tasmania)\b/, "Australia/Hobart"],
    [/\b(vic|victoria)\b/, "Australia/Melbourne"],
    [/\b(nsw|new south wales|act|australian capital territory)\b/, "Australia/Sydney"],
  ];
  for (const [re, tz] of stateMap) if (re.test(s)) return tz;

  return DEFAULT_TZ;
}

