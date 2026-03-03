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
        qr_file_path, qr_file_name,
        brief_content, main_shoot_date
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
    const { data: assignments = [] } = await supabase
      .from("event_assignments")
      .select(`
        id, role, staff_id, user_id,
        staff:staff_id (id, first_name, last_name),
        profile:user_id (full_name, avatar_url)
      `)
      .eq("event_id", event.id);

    // Map to safe crew list
    const team = assignments.map((a: any) => ({
      role: a.role || "Team Member",
      name:
        a.profile?.full_name ||
        (a.staff ? `${a.staff.first_name || ""} ${a.staff.last_name || ""}`.trim() : "TBC"),
      avatar_url: a.profile?.avatar_url || null,
    }));

    // Fetch crew-visible documents
    const { data: documents = [] } = await supabase
      .from("event_documents")
      .select("id, file_name, file_path, description, mime_type, file_size, created_at")
      .eq("event_id", event.id)
      .eq("is_visible_to_crew", true)
      .order("created_at", { ascending: false });

    // Generate signed URLs for documents
    const docsWithUrls = await Promise.all(
      documents.map(async (doc: any) => {
        const { data } = await supabase.storage
          .from("event-documents")
          .createSignedUrl(doc.file_path, 3600);
        return { ...doc, signed_url: data?.signedUrl || null };
      })
    );

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
      brief_content: event.brief_content,
      main_shoot_date: event.main_shoot_date,
      sessions,
      team,
      documents: docsWithUrls,
      contacts,
      qr_file_name: event.qr_file_name,
      qr_signed_url: qrSignedUrl,
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
