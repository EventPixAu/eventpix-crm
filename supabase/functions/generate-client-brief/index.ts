import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS")
    return new Response(null, { headers: corsHeaders });

  try {
    const { eventId } = await req.json();
    if (!eventId) throw new Error("eventId is required");

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY not configured");

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Fetch event with client info
    const { data: event, error: eventError } = await supabase
      .from("events")
      .select(`
        *,
        clients:client_id (
          business_name,
          primary_contact_name,
          primary_contact_email
        )
      `)
      .eq("id", eventId)
      .single();

    if (eventError || !event) throw new Error("Event not found");

    // Fetch sessions
    const { data: sessions } = await supabase
      .from("event_sessions")
      .select("*")
      .eq("event_id", eventId)
      .order("session_date");

    // Fetch contacts
    const { data: contacts } = await supabase
      .from("event_contacts")
      .select("*")
      .eq("event_id", eventId);

    // Fetch assignments with profiles
    const { data: assignments } = await supabase
      .from("event_assignments")
      .select(`
        role_on_event,
        staff_role_id,
        profiles:user_id ( full_name ),
        staff_roles:staff_role_id ( name )
      `)
      .eq("event_id", eventId)
      .eq("confirmation_status", "confirmed");

    // Build context
    const client = (event as any).clients;
    const eventContext = {
      event_name: event.lead_name || event.event_name || "Untitled Event",
      event_type: event.event_type,
      event_date: event.event_date,
      start_time: event.start_time,
      end_time: event.end_time,
      venue_name: event.venue_name,
      venue_address: event.venue_address,
      client_name: client?.business_name,
      contact_name: client?.primary_contact_name,
      sessions: sessions?.map((s: any) => ({
        date: s.session_date,
        start: s.start_time,
        end: s.end_time,
        location: s.location,
        notes: s.notes,
      })),
      contacts: contacts?.map((c: any) => ({
        name: c.contact_name,
        type: c.contact_type,
        phone: c.contact_phone,
        email: c.contact_email,
      })),
      crew: assignments?.map((a: any) => ({
        name: a.profiles?.full_name,
        role: a.staff_roles?.name || a.role_on_event,
      })),
      crew_count: assignments?.length || 0,
      notes: event.notes,
      coverage_hours: event.coverage_hours,
      photographers_count: event.photographers_count,
      pre_registration_link: event.pre_registration_link,
    };

    const systemPrompt = `You are a professional event photography company writing a brief for a client. 
Write a clear, friendly, and professional event brief that the client will see in their portal.
The brief should:
- Confirm key event details (date, time, venue)
- Mention the photography coverage they're getting
- Include photographer name(s) from the crew list if available
- Include any logistics or arrival info
- If a pre-registration link is available, mention that a pre-registration link has been set up and recommend sharing it with attendees — but do NOT include the actual URL (it is shown separately in the portal)
- Be warm but professional in tone
- Use plain text (no markdown headers or bullets with special characters)
- Keep it concise — around 150-250 words
- Do NOT start with a salutation or greeting (no "Dear...", "Hi...", etc.) — jump straight into the content
Do NOT include internal notes.`;

    const response = await fetch(
      "https://ai.gateway.lovable.dev/v1/chat/completions",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${LOVABLE_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "google/gemini-3-flash-preview",
          messages: [
            { role: "system", content: systemPrompt },
            {
              role: "user",
              content: `Generate a client-facing event brief based on this event data:\n\n${JSON.stringify(eventContext, null, 2)}`,
            },
          ],
        }),
      }
    );

    if (!response.ok) {
      const status = response.status;
      if (status === 429) {
        return new Response(
          JSON.stringify({ error: "Rate limit exceeded. Please try again shortly." }),
          { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      if (status === 402) {
        return new Response(
          JSON.stringify({ error: "AI credits exhausted. Please top up." }),
          { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      throw new Error(`AI gateway error: ${status}`);
    }

    const aiData = await response.json();
    const content = aiData.choices?.[0]?.message?.content || "";

    return new Response(JSON.stringify({ content }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("generate-client-brief error:", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
