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
    const { email, secret } = await req.json();
    if (secret !== Deno.env.get("RECOVERY_SECRET")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    const { data: linkData, error: linkErr } = await admin.auth.admin.generateLink({
      type: 'recovery', email, options: { redirectTo: 'https://app.eventpix.com.au/reset-password' },
    });
    if (linkErr || !linkData?.properties?.action_link) {
      return new Response(JSON.stringify({ error: linkErr?.message ?? "Failed to generate link" }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    await sendViaGmailApi(email, "Reset your EventPix password", `
      <h2>Password Reset</h2>
      <p>Click the button below to reset your password:</p>
      <p><a href="${linkData.properties.action_link}" style="background-color: #3b82f6; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; display: inline-block;">Reset My Password</a></p>
      <p>If you didn't request this, you can safely ignore this email.</p>
    `);

    await admin.from("email_logs").insert({
      email_type: "password_recovery", recipient_email: email, recipient_name: email,
      subject: "Reset your EventPix password", body_preview: "Password reset request",
      status: "sent", sent_at: new Date().toISOString(), direction: "outbound",
    }).then(({ error: logErr }) => { if (logErr) console.error("Failed to log recovery email:", logErr); });

    return new Response(JSON.stringify({ success: true }), { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  } catch (e) {
    return new Response(JSON.stringify({ error: String(e) }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }
});
