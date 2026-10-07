import { createClient } from "npm:@supabase/supabase-js@2";
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";

// Emails the business owner about a newly recorded response notification.
// Only accepts a notification id; recipient is always the configured owner email,
// and each notification is emailed at most once (claimed via emailed_at).

const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
const b64 = (s: string) => btoa(Array.from(new TextEncoder().encode(s), (b) => String.fromCharCode(b)).join(""));

async function gmailToken(): Promise<string> {
  const resp = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: Deno.env.get("GMAIL_CLIENT_ID")!, client_secret: Deno.env.get("GMAIL_CLIENT_SECRET")!,
      refresh_token: Deno.env.get("GMAIL_REFRESH_TOKEN")!, grant_type: "refresh_token",
    }),
  });
  if (!resp.ok) throw new Error(`Token refresh failed: ${await resp.text()}`);
  return (await resp.json()).access_token;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  const json = (b: unknown, status = 200) =>
    new Response(JSON.stringify(b), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  try {
    const { notification_id } = await req.json().catch(() => ({}));
    if (typeof notification_id !== "string" || !/^[0-9a-f-]{36}$/i.test(notification_id)) return json({ error: "invalid id" }, 400);

    const db = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    const { data: n } = await db.from("notifications").update({ emailed_at: new Date().toISOString() })
      .eq("id", notification_id).is("emailed_at", null).like("type", "response_%").select("*").maybeSingle();
    if (!n) return json({ skipped: true });

    const { data: s } = await db.from("site_settings").select("value").eq("key", "owner_email").maybeSingle();
    const to = (typeof s?.value === "string" ? s.value : "") || "trevor@eventpix.com.au";
    const base = "https://app.eventpix.com.au";
    const link = n.entity_type === "event" ? `${base}/events/${n.entity_id}`
      : n.entity_type === "lead" ? `${base}/sales/leads/${n.entity_id}` : `${base}/operations`;

    const html = `<div style="font-family:Arial,sans-serif;color:#111"><h2 style="margin:0 0 8px">${esc(n.title)}</h2>
<p>${esc(n.message)}</p><p><a href="${link}" style="background:#111;color:#fff;padding:10px 16px;border-radius:6px;text-decoration:none">Open in Eventpix</a></p></div>`;
    const mime = `From: "EventPix" <pix@eventpix.com.au>\r\nTo: ${to}\r\nSubject: =?UTF-8?B?${b64("Response: " + n.title)}?=\r\nMIME-Version: 1.0\r\nContent-Type: text/html; charset=UTF-8\r\nContent-Transfer-Encoding: base64\r\n\r\n${b64(html)}`;
    const raw = b64(mime).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
    const resp = await fetch("https://gmail.googleapis.com/gmail/v1/users/me/messages/send", {
      method: "POST",
      headers: { Authorization: `Bearer ${await gmailToken()}`, "Content-Type": "application/json" },
      body: JSON.stringify({ raw }),
    });
    if (!resp.ok) {
      const t = await resp.text();
      console.error(`Gmail failed [${resp.status}]: ${t}`);
      await db.from("notifications").update({ emailed_at: null }).eq("id", notification_id);
      return json({ error: "send failed", details: t }, 502);
    }
    return json({ sent: true });
  } catch (e) {
    console.error(e);
    return json({ error: String(e) }, 500);
  }
});
