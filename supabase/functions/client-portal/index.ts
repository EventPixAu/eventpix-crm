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
        lead_id, quote_id,
        client_brief_template_id, client_brief_file_name, client_brief_file_path
      `)
      .eq("client_portal_token", token)
      .single();

    let templateBriefPdfName: string | null = null;
    let templateBriefPdfPath: string | null = null;
...
    // Generate signed URL for QR file
    let qrSignedUrl = null;
    if (event.qr_file_path) {
      const { data } = await supabase.storage
        .from("event-documents")
        .createSignedUrl(event.qr_file_path, 3600);
      qrSignedUrl = data?.signedUrl || null;
    }

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

    let briefAttachmentSignedUrl = null;
    if (briefAttachmentPath) {
      const bucket = event.client_brief_file_path ? "event-documents" : "client-brief-template-files";
      const { data } = await supabase.storage
        .from(bucket)
        .createSignedUrl(briefAttachmentPath, 3600);
      briefAttachmentSignedUrl = data?.signedUrl || null;
    }
...
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
