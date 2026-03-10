import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const url = new URL(req.url);
    const token = url.searchParams.get("token");

    if (!token || token.length < 32) {
      return new Response(JSON.stringify({ error: "Invalid token" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // Fetch lead by portal token
    const { data: lead, error: leadError } = await supabase
      .from("leads")
      .select(`
        id, lead_name, client_id, estimated_event_date, 
        venue_text, source, requirements_summary, notes,
        event_type_id, status
      `)
      .eq("client_portal_token", token)
      .single();

    if (leadError || !lead) {
      return new Response(JSON.stringify({ error: "Lead not found" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Fetch client name
    let clientName = null;
    if (lead.client_id) {
      const { data: client } = await supabase
        .from("clients")
        .select("business_name")
        .eq("id", lead.client_id)
        .single();
      clientName = client?.business_name;
    }

    // Fetch sessions linked to this lead
    const { data: sessions = [] } = await supabase
      .from("event_sessions")
      .select("id, session_date, start_time, end_time, session_label, location, notes, sort_order")
      .eq("lead_id", lead.id)
      .order("session_date")
      .order("sort_order");

    // Fetch event type name
    let eventTypeName = null;
    if (lead.event_type_id) {
      const { data: et } = await supabase
        .from("event_types")
        .select("name")
        .eq("id", lead.event_type_id)
        .single();
      eventTypeName = et?.name;
    }

    // Fetch enquiry contacts
    const { data: rawContacts = [] } = await supabase
      .from("enquiry_contacts")
      .select(`
        id, role, contact_name, contact_email, contact_phone, notes,
        contact:client_contacts!enquiry_contacts_contact_id_fkey (
          contact_name, email, phone_mobile, phone
        )
      `)
      .eq("lead_id", lead.id);

    const contacts = (rawContacts || []).map((c: any) => ({
      id: c.id,
      contact_type: c.role || "primary",
      contact_name: c.contact_name || c.contact?.contact_name || null,
      contact_email: c.contact_email || c.contact?.email || null,
      contact_phone: c.contact_phone || c.contact?.phone_mobile || c.contact?.phone || null,
      notes: c.notes,
    }));

    // Fetch quotes linked to this lead
    const { data: quotes = [] } = await supabase
      .from("quotes")
      .select("id, quote_number, status, public_token, total_estimate, created_at")
      .eq("lead_id", lead.id)
      .order("created_at", { ascending: false });

    // Fetch contracts linked to this lead
    const { data: contracts = [] } = await supabase
      .from("contracts")
      .select("id, title, status, public_token, signed_at, sent_at, created_at")
      .eq("lead_id", lead.id)
      .order("created_at", { ascending: false });

    const safeContracts = (contracts || []).map((c: any) => ({
      id: c.id,
      title: c.title,
      status: c.status,
      public_token: c.public_token,
      signed_at: c.signed_at,
      sent_at: c.sent_at,
    }));

    const safeQuotes = (quotes || []).map((q: any) => ({
      id: q.id,
      quote_number: q.quote_number,
      status: q.status,
      public_token: q.public_token,
      total_estimate: q.total_estimate,
    }));

    // Fetch venue details if venue_text references a venue
    let venue = null;
    // Lead uses venue_text, not venue_id, so we pass it as venue_name

    const response = {
      event_name: lead.lead_name,
      event_date: lead.estimated_event_date,
      start_time: null,
      end_time: null,
      client_name: clientName,
      venue_name: lead.venue_text,
      venue: null,
      event_type: eventTypeName,
      special_instructions: lead.requirements_summary,
      photography_brief: null,
      brief_content: null,
      main_shoot_date: lead.estimated_event_date,
      sessions,
      team: [],
      contacts,
      contracts: safeContracts,
      quotes: safeQuotes,
      qr_file_name: null,
      qr_signed_url: null,
      is_lead: true,
    };

    return new Response(JSON.stringify(response), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("Lead portal error:", err);
    return new Response(JSON.stringify({ error: "Internal server error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
