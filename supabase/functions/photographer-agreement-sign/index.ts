import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const admin = createClient(supabaseUrl, serviceKey);
  const url = new URL(req.url);
  const token = url.searchParams.get("token") || (req.method === "POST" ? undefined : null);

  try {
    if (req.method === "GET") {
      if (!token) return new Response(JSON.stringify({ error: "token required" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      const { data: c } = await admin.from("photographer_contracts").select("id, title, rendered_html, signed_html_snapshot, status, signed_at, signed_by_name, signing_token_expires_at, photographer_id, template_name").eq("signing_token", token).maybeSingle();
      if (!c) return new Response(JSON.stringify({ error: "Invalid or expired link" }), { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      if (c.status === "cancelled") return new Response(JSON.stringify({ error: "This agreement has been cancelled." }), { status: 410, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      if (c.signing_token_expires_at && new Date(c.signing_token_expires_at) < new Date() && c.status !== "signed") {
        await admin.from("photographer_contracts").update({ status: "expired" }).eq("id", c.id);
        return new Response(JSON.stringify({ error: "This signing link has expired." }), { status: 410, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }
      const { data: p } = await admin.from("profiles").select("full_name, business_name").eq("id", c.photographer_id).maybeSingle();
      if (c.status !== "signed" && c.status !== "viewed") {
        await admin.from("photographer_contracts").update({ status: "viewed", viewed_at: new Date().toISOString() }).eq("id", c.id);
        await admin.from("photographer_contract_audit").insert({ contract_id: c.id, event_type: "viewed" });
      }
      return new Response(JSON.stringify({
        contract_id: c.id,
        title: c.title,
        template_name: c.template_name,
        rendered_html: c.signed_html_snapshot || c.rendered_html,
        status: c.status,
        signed_at: c.signed_at,
        signed_by_name: c.signed_by_name,
        photographer_name: p?.full_name || "",
        business_name: p?.business_name || "",
      }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    if (req.method === "POST") {
      const body = await req.json();
      const { token: postToken, full_name, email, signature_data, accepted } = body;
      if (!postToken || !full_name || !email || !accepted) return new Response(JSON.stringify({ error: "Missing required fields" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      const { data: c } = await admin.from("photographer_contracts").select("*").eq("signing_token", postToken).maybeSingle();
      if (!c) return new Response(JSON.stringify({ error: "Invalid link" }), { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      if (c.status === "signed") return new Response(JSON.stringify({ error: "This agreement has already been signed." }), { status: 409, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      if (c.status === "cancelled") return new Response(JSON.stringify({ error: "This agreement has been cancelled." }), { status: 410, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      if (c.signing_token_expires_at && new Date(c.signing_token_expires_at) < new Date()) {
        await admin.from("photographer_contracts").update({ status: "expired" }).eq("id", c.id);
        return new Response(JSON.stringify({ error: "This signing link has expired." }), { status: 410, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }
      const ip = req.headers.get("x-forwarded-for")?.split(",")[0].trim() || null;
      const ua = req.headers.get("user-agent") || null;
      const nowIso = new Date().toISOString();
      await admin.from("photographer_contracts").update({
        status: "signed",
        signed_at: nowIso,
        signed_by_name: full_name,
        signed_by_email: email,
        signature_data: signature_data || full_name,
        signed_html_snapshot: c.rendered_html,
        ip_address: ip,
        user_agent: ua,
        signing_token: null,
      }).eq("id", c.id);
      await admin.from("photographer_contract_audit").insert({ contract_id: c.id, event_type: "signed", event_description: `Signed by ${full_name} <${email}>`, ip_address: ip, user_agent: ua });
      return new Response(JSON.stringify({ success: true }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    return new Response(JSON.stringify({ error: "Method not allowed" }), { status: 405, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (e) {
    console.error(e);
    return new Response(JSON.stringify({ error: (e as Error).message }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
