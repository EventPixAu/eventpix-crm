import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

function firstString(...values: unknown[]): string | undefined {
  for (const v of values) if (typeof v === "string" && v.trim()) return v;
  return undefined;
}

async function fetchResendBody(emailId: string, apiKey: string): Promise<{ text?: string; html?: string }> {
  const delays = [0, 1000, 2000];
  for (let i = 0; i < delays.length; i++) {
    if (delays[i] > 0) await new Promise((r) => setTimeout(r, delays[i]));
    try {
      const resp = await fetch(`https://api.resend.com/emails/receiving/${encodeURIComponent(emailId)}`, {
        headers: { Authorization: `Bearer ${apiKey}` },
      });
      const raw = await resp.text();
      if (!resp.ok) {
        console.error(`Retry attempt ${i + 1} failed:`, resp.status, raw.slice(0, 300));
        continue;
      }
      let parsed: any = {};
      try { parsed = JSON.parse(raw); } catch { continue; }
      const email = parsed?.data ?? parsed;
      const text = firstString(email.text, email.text_body, email.body_text, email.plain, email.body_plain, email.plain_text);
      const html = firstString(email.html, email.html_body, email.body_html, email.html_content);
      if (text || html) return { text, html };
    } catch (e) {
      console.error(`Retry attempt ${i + 1} error:`, e);
    }
  }
  return {};
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
  const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

  const authHeader = req.headers.get("Authorization");
  if (!authHeader) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const userClient = createClient(SUPABASE_URL, SERVICE_KEY, {
    global: { headers: { Authorization: authHeader } },
  });
  const { data: userData, error: userErr } = await userClient.auth.getUser(authHeader.replace("Bearer ", ""));
  if (userErr || !userData?.user) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const { data: roleData } = await userClient.rpc("current_user_role");
  const role = typeof roleData === "string" ? roleData : (roleData as any)?.role ?? null;
  if (!role || !["admin", "sales", "operations"].includes(role)) {
    return new Response(JSON.stringify({ error: "Forbidden" }), {
      status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const supabase = createClient(SUPABASE_URL, SERVICE_KEY);

  let body: any = {};
  try { body = await req.json(); } catch {}
  const emailLogId = body?.email_log_id;
  if (!emailLogId) {
    return new Response(JSON.stringify({ error: "email_log_id is required" }), {
      status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const { data: row, error: rowErr } = await supabase
    .from("email_logs")
    .select("id, direction, resend_email_id, body_html, body_text")
    .eq("id", emailLogId)
    .maybeSingle();
  if (rowErr || !row) {
    return new Response(JSON.stringify({ error: "Email not found" }), {
      status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
  if (!row.resend_email_id) {
    return new Response(JSON.stringify({ error: "No provider reference stored for this email — it can't be retried." }), {
      status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const apiKey = Deno.env.get("RESEND_API_KEY");
  if (!apiKey) {
    return new Response(JSON.stringify({ error: "Email provider is not configured." }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const { text, html } = await fetchResendBody(row.resend_email_id, apiKey);
  if (!text && !html) {
    return new Response(JSON.stringify({ success: false, error: "Content still isn't available from the email provider. Try again in a few minutes." }), {
      status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const bodyPreview = text
    ? text.substring(0, 200)
    : (html || "").replace(/<[^>]*>/g, "").substring(0, 200);

  const { error: updateErr } = await supabase
    .from("email_logs")
    .update({ body_html: html || null, body_text: text || null, body_preview: bodyPreview })
    .eq("id", emailLogId);
  if (updateErr) {
    return new Response(JSON.stringify({ success: false, error: updateErr.message }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  return new Response(JSON.stringify({
    success: true,
    body_html: html || null,
    body_text: text || null,
    body_preview: bodyPreview,
  }), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
});
