import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

// v3 brief attachment
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

    const { data: event, error: eventError } = await supabase
      .from("events")
      .select(`
        id, event_name, event_date, start_time, end_time,
        venue_name, venue_id, client_id, client_name, event_type_id,
        special_instructions, notes, photography_brief,
        onsite_contact_name, onsite_contact_phone,
        qr_file_path, qr_file_name, pre_registration_link,
        brief_content, client_brief_content, main_shoot_date,
        lead_id, quote_id,
        client_brief_template_id, client_brief_file_name, client_brief_file_path
      `)
      .eq("client_portal_token", token)
      .maybeSingle();

    if (eventError || !event) {
      return new Response(JSON.stringify({ error: "Event not found" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Venue
    let venue: any = null;
    if (event.venue_id) {
      const { data: v } = await supabase
        .from("venues")
        .select("id, name, address, city, state, postcode, country")
        .eq("id", event.venue_id)
        .maybeSingle();
      venue = v || null;
    }

    // Event type name
    let eventTypeName: string | null = null;
    if (event.event_type_id) {
      const { data: et } = await supabase
        .from("event_types")
        .select("name")
        .eq("id", event.event_type_id)
        .maybeSingle();
      eventTypeName = et?.name || null;
    }

    // Sessions
    const { data: sessions } = await supabase
      .from("event_sessions")
      .select("id, session_label, session_date, start_time, end_time, venue_name, notes")
      .eq("event_id", event.id)
      .order("session_date", { ascending: true });

    // Team (assignments)
    const { data: assignments } = await supabase
      .from("event_assignments")
      .select(`
        id, user_id, staff_id, staff_role_id, role_on_event, assignment_status,
        profile:profiles!event_assignments_user_id_fkey ( full_name, phone, avatar_url ),
        staff_role:staff_roles!event_assignments_staff_role_id_fkey ( name ),
        staff:staff_id ( name, role )
      `)
      .eq("event_id", event.id);

    const team = (assignments || [])
      .map((a: any) => {
        const profile = a.profile;
        const staff = a.staff;
        return {
          name: profile?.full_name || staff?.name || "Team Member",
          phone: profile?.phone || null,
          avatar_url: profile?.avatar_url || null,
          role: a.staff_role?.name || a.role_on_event || staff?.role || "Team",
        };
      })
      .filter((member: any) => !member.role?.toLowerCase().includes("editor"));

    // Contacts
    const { data: rawContacts } = await supabase
      .from("event_contacts")
      .select(`
        id, contact_name, contact_email, contact_phone, contact_type, notes, sort_order,
        client_contact:client_contacts!event_contacts_client_contact_id_fkey (
          id, contact_name, email, phone, phone_mobile, phone_office, role_title, role
        )
      `)
      .eq("event_id", event.id)
      .order("sort_order", { ascending: true });

    const contacts = (rawContacts || []).map((c: any) => {
      const cc = c.client_contact;
      return {
        id: c.id,
        contact_type: c.contact_type || "primary",
        contact_name: c.contact_name || cc?.contact_name || null,
        contact_email: c.contact_email || cc?.email || null,
        contact_phone: c.contact_phone || cc?.phone_mobile || cc?.phone_office || cc?.phone || null,
        notes: c.notes || null,
      };
    });

    if (event.onsite_contact_name && !contacts.some((c: any) => c.contact_name === event.onsite_contact_name)) {
      let onsiteContact: any = null;
      if (event.client_id) {
        const { data } = await supabase
          .from("client_contacts")
          .select("id, contact_name, email, phone, phone_mobile, phone_office")
          .eq("client_id", event.client_id)
          .ilike("contact_name", event.onsite_contact_name)
          .limit(1)
          .maybeSingle();
        onsiteContact = data;
      }

      contacts.push({
        id: onsiteContact?.id || `onsite-${event.id}`,
        contact_type: "onsite",
        contact_name: event.onsite_contact_name,
        contact_email: onsiteContact?.email || null,
        contact_phone: event.onsite_contact_phone || onsiteContact?.phone_mobile || onsiteContact?.phone_office || onsiteContact?.phone || null,
        notes: null,
      });
    }

    // Contracts
    const { data: rawContracts } = await supabase
      .from("contracts")
      .select("id, title, status, sent_at, signed_at, public_token")
      .eq("event_id", event.id);
    const safeContracts = rawContracts || [];

    // Quotes
    const { data: rawQuotes } = await supabase
      .from("quotes")
      .select("id, quote_number, status, total_estimate, public_token")
      .eq("event_id", event.id);
    const safeQuotes = rawQuotes || [];

    // QR signed URL
    let qrSignedUrl: string | null = null;
    if (event.qr_file_path) {
      const { data } = await supabase.storage
        .from("event-documents")
        .createSignedUrl(event.qr_file_path, 3600);
      qrSignedUrl = data?.signedUrl || null;
    }

    // Brief attachment (event override OR template PDF)
    let templateBriefPdfName: string | null = null;
    let templateBriefPdfPath: string | null = null;
    if (event.client_brief_template_id) {
      const { data: template } = await supabase
        .from("client_brief_templates")
        .select("pdf_file_name, pdf_file_path")
        .eq("id", event.client_brief_template_id)
        .maybeSingle();
      templateBriefPdfName = template?.pdf_file_name || null;
      templateBriefPdfPath = template?.pdf_file_path || null;
    }

    const briefAttachmentName = event.client_brief_file_name || templateBriefPdfName || null;
    const briefAttachmentPath = event.client_brief_file_path || templateBriefPdfPath || null;

    let briefAttachmentSignedUrl: string | null = null;
    if (briefAttachmentPath) {
      const bucket = event.client_brief_file_path ? "event-documents" : "client-brief-template-files";
      const { data } = await supabase.storage
        .from(bucket)
        .createSignedUrl(briefAttachmentPath, 3600);
      briefAttachmentSignedUrl = data?.signedUrl || null;
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
      brief_content: event.client_brief_content,
      brief_attachment_name: briefAttachmentName,
      brief_attachment_url: briefAttachmentSignedUrl,
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
