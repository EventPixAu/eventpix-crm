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

    // Fetch event by portal token
    const { data: event, error: eventError } = await supabase
      .from("events")
      .select(`
        id, event_name, event_date, start_time, end_time, 
        venue_name, venue_id, client_name, event_type_id,
        special_instructions, notes, photography_brief,
        qr_file_path, qr_file_name, pre_registration_link,
        brief_content, client_brief_content, main_shoot_date,
        lead_id, quote_id
      `)
      .eq("client_portal_token", token)
      .single();

    if (eventError || !event) {
      return new Response(JSON.stringify({ error: "Event not found" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Fetch sessions
    const { data: sessions = [] } = await supabase
      .from("event_sessions")
      .select("id, session_date, start_time, end_time, session_label, location, notes, sort_order")
      .eq("event_id", event.id)
      .order("session_date")
      .order("sort_order");

    // Fetch assigned crew (public info only)
    const { data: assignments } = await supabase
      .from("event_assignments")
      .select(`
        id, role_on_event, staff_id, user_id, staff_role_id,
        staff:staff_id (id, name, phone),
        profile:profiles!event_assignments_user_id_fkey (full_name, avatar_url, phone),
        staff_role:staff_roles!event_assignments_staff_role_id_fkey (name)
      `)
      .eq("event_id", event.id);

    // Map to safe crew list
    const team = (assignments || []).map((a: any) => ({
      role: a.staff_role?.name || a.role_on_event || "Team Member",
      name: a.profile?.full_name || a.staff?.name || "TBC",
      avatar_url: a.profile?.avatar_url || null,
      phone: a.profile?.phone || a.staff?.phone || null,
    }));

    // Generate signed URL for QR file
    let qrSignedUrl = null;
    if (event.qr_file_path) {
      const { data } = await supabase.storage
        .from("event-documents")
        .createSignedUrl(event.qr_file_path, 3600);
      qrSignedUrl = data?.signedUrl || null;
    }

    // Fetch event contacts
    const { data: contacts = [] } = await supabase
      .from("event_contacts")
      .select("id, contact_type, contact_name, contact_email, contact_phone, notes")
      .eq("event_id", event.id)
      .order("contact_type");

    // Fetch venue details if available
    let venue = null;
    if (event.venue_id) {
      const { data: v } = await supabase
        .from("venues")
        .select("name, address_line_1, address_line_2, city, state, postcode, google_maps_url")
        .eq("id", event.venue_id)
        .single();
      venue = v;
    }

    // Fetch event type name
    let eventTypeName = null;
    if (event.event_type_id) {
      const { data: et } = await supabase
        .from("event_types")
        .select("name")
        .eq("id", event.event_type_id)
        .single();
      eventTypeName = et?.name;
    }

    // Fetch contracts linked to the event
    const { data: contracts = [] } = await supabase
      .from("contracts")
      .select("id, title, status, public_token, signed_at, sent_at, created_at")
      .or(`event_id.eq.${event.id}${event.lead_id ? `,lead_id.eq.${event.lead_id}` : ''}`)
      .order("created_at", { ascending: false });

    // Fetch quotes linked to the event
    const { data: quotes = [] } = await supabase
      .from("quotes")
      .select("id, quote_number, status, public_token, total_estimate, created_at")
      .or(`event_id.eq.${event.id},linked_event_id.eq.${event.id}${event.lead_id ? `,lead_id.eq.${event.lead_id}` : ''}`)
      .order("created_at", { ascending: false });

    // Map contracts to safe public data
    const safeContracts = (contracts || []).map((c: any) => ({
      id: c.id,
      title: c.title,
      status: c.status,
      public_token: c.public_token,
      signed_at: c.signed_at,
      sent_at: c.sent_at,
    }));

    // Map quotes to safe public data
    const safeQuotes = (quotes || []).map((q: any) => ({
      id: q.id,
      quote_number: q.quote_number,
      status: q.status,
      public_token: q.public_token,
      total_estimate: q.total_estimate,
    }));

    const response = {
      event_name: event.event_name,
      event_date: event.event_date,
      start_time: event.start_time,
      end_time: event.end_time,
      client_name: event.client_name,
      venue_name: event.venue_name,
      venue,
      event_type: eventTypeName,
      special_instructions: event.special_instructions,
      photography_brief: event.photography_brief,
      brief_content: event.client_brief_content,
      main_shoot_date: event.main_shoot_date,
      sessions,
      team,
      contacts,
      contracts: safeContracts,
      quotes: safeQuotes,
      qr_file_name: event.qr_file_name,
      qr_signed_url: qrSignedUrl,
      pre_registration_link: event.pre_registration_link || null,
    };

    return new Response(JSON.stringify(response), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("Client portal error:", err);
    return new Response(JSON.stringify({ error: "Internal server error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
