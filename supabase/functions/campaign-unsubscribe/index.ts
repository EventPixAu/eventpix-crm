// Public endpoint — marks a contact as unsubscribed from all future campaigns.
// No JWT required. Looks up client_contacts by email and flips unsubscribed=true.
import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, serviceKey);

    let email = "";
    let campaignId = "";
    if (req.method === "POST") {
      const body = await req.json().catch(() => ({}));
      email = (body.email || "").toString().trim().toLowerCase();
      campaignId = (body.campaignId || body.c || "").toString();
    } else {
      const url = new URL(req.url);
      email = (url.searchParams.get("email") || "").trim().toLowerCase();
      campaignId = (url.searchParams.get("c") || "").trim();
    }

    if (!email) {
      return new Response(JSON.stringify({ success: false, error: "Email required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: matches } = await supabase
      .from("client_contacts")
      .select("id, contact_name, email, unsubscribed")
      .ilike("email", email);

    if (!matches || matches.length === 0) {
      return new Response(JSON.stringify({ success: true, alreadyUnsubscribed: false, message: "Unsubscribed" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const ids = matches.map((m) => m.id);
    const alreadyDone = matches.every((m) => m.unsubscribed);

    await supabase
      .from("client_contacts")
      .update({ unsubscribed: true, unsubscribed_at: new Date().toISOString() })
      .in("id", ids);

    // Log activity
    for (const m of matches) {
      await supabase.from("contact_activities").insert({
        contact_id: m.id,
        activity_type: "system",
        activity_date: new Date().toISOString(),
        subject: "Unsubscribed from email campaigns",
        notes: campaignId ? `Unsubscribed via campaign ${campaignId}` : "Unsubscribed via public link",
      });
    }

    return new Response(JSON.stringify({ success: true, alreadyUnsubscribed: alreadyDone, count: matches.length }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return new Response(JSON.stringify({ success: false, error: msg }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
