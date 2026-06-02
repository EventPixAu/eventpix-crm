import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

async function getGmailAccessToken(): Promise<string> {
  const clientId = Deno.env.get("GMAIL_CLIENT_ID");
  const clientSecret = Deno.env.get("GMAIL_CLIENT_SECRET");
  const refreshToken = Deno.env.get("GMAIL_REFRESH_TOKEN");
  if (!clientId || !clientSecret || !refreshToken) throw new Error("Gmail OAuth2 credentials not configured");
  const resp = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ client_id: clientId, client_secret: clientSecret, refresh_token: refreshToken, grant_type: "refresh_token" }),
  });
  if (!resp.ok) throw new Error(`Token refresh failed: ${await resp.text()}`);
  return (await resp.json()).access_token;
}

async function sendViaGmailApi(to: string, subject: string, html: string): Promise<void> {
  const accessToken = await getGmailAccessToken();
  const from = '"EventPix" <pix@eventpix.com.au>';
  const encodedSubject = `=?UTF-8?B?${btoa(unescape(encodeURIComponent(subject)))}?=`;
  const mime = `From: ${from}\r\nTo: ${to}\r\nSubject: ${encodedSubject}\r\nMIME-Version: 1.0\r\nContent-Type: text/html; charset=UTF-8\r\nContent-Transfer-Encoding: base64\r\n\r\n${btoa(unescape(encodeURIComponent(html)))}`;
  const raw = btoa(mime).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
  const resp = await fetch("https://gmail.googleapis.com/gmail/v1/users/me/messages/send", {
    method: "POST", headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" },
    body: JSON.stringify({ raw }),
  });
  if (!resp.ok) throw new Error(`Gmail API error: ${await resp.text()}`);
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

  try {
    const body = await req.json();
    const emailRaw: string = (body?.email ?? '').toString().trim().toLowerCase();
    const redirectTo: string = body?.redirectTo ?? 'https://app.eventpix.com.au/portal';
    if (!emailRaw || !emailRaw.includes('@')) {
      return new Response(JSON.stringify({ error: "Invalid email" }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

    // Check if user exists; if not, create one (client portal users)
    let userExists = false;
    try {
      // listUsers paged; filter by email via getUserByEmail-like approach
      const { data: list } = await admin.auth.admin.listUsers({ page: 1, perPage: 200 });
      userExists = !!list?.users?.find((u) => (u.email ?? '').toLowerCase() === emailRaw);
    } catch (_) { /* ignore */ }

    if (!userExists) {
      const { error: createErr } = await admin.auth.admin.createUser({
        email: emailRaw,
        email_confirm: true,
      });
      if (createErr && !createErr.message?.toLowerCase().includes('already')) {
        return new Response(JSON.stringify({ error: createErr.message }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      }
    }

    const { data: linkData, error: linkErr } = await admin.auth.admin.generateLink({
      type: 'magiclink',
      email: emailRaw,
      options: { redirectTo },
    });
    if (linkErr || !linkData?.properties?.action_link) {
      return new Response(JSON.stringify({ error: linkErr?.message ?? "Failed to generate link" }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    const actionLink = linkData.properties.action_link;

    await sendViaGmailApi(emailRaw, "Your Eventpixii Client Portal login link", `
      <div style="font-family: Arial, sans-serif; max-width: 560px;">
        <h2 style="margin: 0 0 16px;">Sign in to your Client Portal</h2>
        <p>Click the button below to securely sign in. This link will expire shortly and can be used once.</p>
        <p style="margin: 24px 0;">
          <a href="${actionLink}" style="background-color:#000;color:#fff;padding:12px 24px;text-decoration:none;border-radius:6px;display:inline-block;font-weight:500;">
            Open Client Portal
          </a>
        </p>
        <p style="color:#666;font-size:13px;">If the button doesn't work, copy and paste this URL into your browser:<br/>
          <span style="word-break:break-all;">${actionLink}</span>
        </p>
        <p style="color:#999;font-size:12px;margin-top:24px;">If you didn't request this, you can safely ignore this email.</p>
      </div>
    `);

    await admin.from("email_logs").insert({
      email_type: "client_magic_link",
      recipient_email: emailRaw,
      recipient_name: emailRaw,
      subject: "Your Eventpixii Client Portal login link",
      body_preview: "Client portal magic link",
      status: "sent",
      sent_at: new Date().toISOString(),
      direction: "outbound",
    }).then(({ error: logErr }) => { if (logErr) console.error("Failed to log magic link email:", logErr); });

    return new Response(JSON.stringify({ success: true }), { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  } catch (e) {
    console.error('send-client-magic-link error', e);
    return new Response(JSON.stringify({ error: String(e) }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }
});
