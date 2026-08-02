import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const ADMIN_EMAIL = "pix@eventpix.com.au";
const APP_URL = "https://app.eventpix.com.au";

async function getGmailAccessToken(): Promise<string> {
  const clientId = Deno.env.get("GMAIL_CLIENT_ID");
  const clientSecret = Deno.env.get("GMAIL_CLIENT_SECRET");
  const refreshToken = Deno.env.get("GMAIL_REFRESH_TOKEN");
  if (!clientId || !clientSecret || !refreshToken) {
    throw new Error("Gmail OAuth2 credentials not configured");
  }
  const resp = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      refresh_token: refreshToken,
      grant_type: "refresh_token",
    }),
  });
  if (!resp.ok) throw new Error(`Token refresh failed: ${await resp.text()}`);
  return (await resp.json()).access_token;
}

function base64UrlEncode(str: string): string {
  return btoa(str).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

async function sendEmail(to: string, subject: string, html: string): Promise<void> {
  const accessToken = await getGmailAccessToken();
  const encodedSubject = `=?UTF-8?B?${btoa(unescape(encodeURIComponent(subject)))}?=`;
  const mime =
    `From: "EventPix" <pix@eventpix.com.au>\r\nTo: ${to}\r\nSubject: ${encodedSubject}\r\n` +
    `MIME-Version: 1.0\r\nContent-Type: text/html; charset=UTF-8\r\nContent-Transfer-Encoding: base64\r\n\r\n` +
    btoa(unescape(encodeURIComponent(html)));
  const resp = await fetch("https://gmail.googleapis.com/gmail/v1/users/me/messages/send", {
    method: "POST",
    headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" },
    body: JSON.stringify({ raw: base64UrlEncode(mime) }),
  });
  if (!resp.ok) throw new Error(`Gmail API error: ${await resp.text()}`);
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { kind } = await req.json() as { kind: "first_login" | "submitted" };
    if (kind !== "first_login" && kind !== "submitted") {
      return new Response(JSON.stringify({ error: "invalid kind" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const authHeader = req.headers.get("Authorization") ?? "";
    const token = authHeader.replace("Bearer ", "");
    const { data: userData, error: userErr } = await supabase.auth.getUser(token);
    if (userErr || !userData?.user) {
      return new Response(JSON.stringify({ error: "unauthorized" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const userId = userData.user.id;

    const { data: profile } = await supabase
      .from("profiles")
      .select("id, full_name, email, phone, onboarding_status, first_login_at, first_login_notified_at, onboarding_submitted_at, onboarding_submitted_notified_at")
      .eq("id", userId)
      .maybeSingle();

    if (!profile) {
      return new Response(JSON.stringify({ skipped: "no_profile" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const now = new Date().toISOString();
    const name = profile.full_name || profile.email || "A team member";
    const emailAddr = profile.email || userData.user.email || "";

    if (kind === "first_login") {
      if (profile.first_login_notified_at) {
        return new Response(JSON.stringify({ skipped: "already_notified" }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      await sendEmail(
        ADMIN_EMAIL,
        `Onboarding started: ${name}`,
        `<div style="font-family:Arial,sans-serif;font-size:14px;color:#111">
          <h2 style="margin:0 0 12px">Team member accessed onboarding</h2>
          <p><strong>${name}</strong> (${emailAddr}) has signed in for the first time and opened their onboarding profile.</p>
          <p><a href="${APP_URL}/staff/${profile.id}">View their profile</a></p>
        </div>`,
      );
      await supabase.from("profiles")
        .update({ first_login_at: profile.first_login_at ?? now, first_login_notified_at: now })
        .eq("id", profile.id);
    } else {
      if (profile.onboarding_submitted_notified_at) {
        return new Response(JSON.stringify({ skipped: "already_notified" }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      await sendEmail(
        ADMIN_EMAIL,
        `Onboarding completed: ${name}`,
        `<div style="font-family:Arial,sans-serif;font-size:14px;color:#111">
          <h2 style="margin:0 0 12px">Onboarding submitted for review</h2>
          <p><strong>${name}</strong> (${emailAddr}${profile.phone ? `, ${profile.phone}` : ""}) has completed their onboarding profile.</p>
          <p>Status: pending review — please verify their details and compliance documents.</p>
          <p><a href="${APP_URL}/staff/${profile.id}">Review profile</a></p>
        </div>`,
      );
      await supabase.from("profiles")
        .update({ onboarding_submitted_at: now, onboarding_submitted_notified_at: now })
        .eq("id", profile.id);
    }

    return new Response(JSON.stringify({ success: true }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("notify-onboarding error", e);
    return new Response(JSON.stringify({ error: String(e) }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
