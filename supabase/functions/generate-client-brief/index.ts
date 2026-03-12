import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

const OFFSITE_ROLES = ["editor", "retoucher", "post-production", "post production"];

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

    // Fetch assignments with profiles
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

    // Fetch sessions for call/arrival time
    const { data: sessions } = await supabase
      .from("event_sessions")
      .select("session_date, start_time, end_time, arrival_time, location, notes")
      .eq("event_id", eventId)
      .order("session_date");

    // Filter to onsite crew only
    const onsiteCrew = (assignments || []).filter((a: any) => {
      const role = (a.staff_roles?.name || a.role_on_event || "").toLowerCase();
      return !OFFSITE_ROLES.some((offsite) => role.includes(offsite));
    });

    // Build context
    const client = (event as any).clients;
    const eventContext = {
      event_name: event.lead_name || event.event_name || "Untitled Event",
      event_type: event.event_type,
      client_name: client?.business_name,
      contact_name: client?.primary_contact_name,
      onsite_crew: onsiteCrew.map((a: any) => ({
        name: a.profiles?.full_name,
        role: a.staff_roles?.name || a.role_on_event,
      })),
      onsite_crew_count: onsiteCrew.length,
      coverage_hours: event.coverage_hours,
      photographers_count: event.photographers_count,
      pre_registration_link: event.pre_registration_link,
      team_brief: event.brief_content || null,
      session_call_times: sessions?.filter((s: any) => s.arrival_time).map((s: any) => ({
        session_date: s.session_date,
        call_time: s.arrival_time,
        start_time: s.start_time,
      })) || [],
      notes: event.notes,
    };

    const systemPrompt = `You are a professional event photography company writing a brief for a client. 
Write a clear, friendly, and professional event brief that the client will see in their portal.
The brief should:
- Do NOT repeat event details like date, time, or venue — those are shown separately in the portal
- Mention the photography coverage they're getting (hours, number of photographers)
- Only mention ONSITE crew members (photographers, assistants, etc.) — do NOT mention editors, retouchers, or any offsite/post-production roles
- If a "team_brief" is provided, use it to determine arrival time and any setup details — reference these naturally (e.g. "Your photographer will arrive [time from team brief] before the start to [setup details from team brief]"). Do NOT fabricate or guess arrival times if the team brief doesn't mention them.
- If a pre-registration link is available, mention that a pre-registration link has been set up and recommend sharing it with attendees — but do NOT include the actual URL (it is shown separately in the portal)
- Be warm but professional in tone
- Use plain text (no markdown headers or bullets with special characters)
- Keep it concise — around 150-250 words
- Do NOT start with a salutation or greeting (no "Dear...", "Hi...", etc.) — jump straight into the content
- Do NOT include any internal notes, internal logistics, or information meant only for the team
- The "team_brief" is INTERNAL — extract relevant client-facing details (like arrival time) but do NOT copy internal instructions verbatim`;

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
