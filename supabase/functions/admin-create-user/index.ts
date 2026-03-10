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
    const { invitation_id, resend_access_for_user_id, email } = body;

    if (!invitation_id && !resend_access_for_user_id) {
      return new Response(JSON.stringify({ success: false, error: 'invitation_id or resend_access_for_user_id is required' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    const authHeader = req.headers.get("Authorization") ?? "";
    const caller = createClient(supabaseUrl, anonKey, { global: { headers: { Authorization: authHeader } } });
    const admin = createClient(supabaseUrl, serviceRoleKey);

    const { data: roleData, error: roleErr } = await caller.rpc("current_user_role");
    if (roleErr || roleData !== "admin") {
      return new Response(JSON.stringify({ success: false, error: "Unauthorized - admin role required" }), { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    const appBaseUrl = (Deno.env.get("INVITE_REDIRECT_URL") || supabaseUrl.replace('.supabase.co', '.lovable.app')).replace(/\/+$/, "");
    const inviteRedirectTo = `${appBaseUrl}/`;
    const passwordRedirectTo = `${appBaseUrl}/reset-password`;

    // Handle resend access email for existing user
    if (resend_access_for_user_id && email) {
      console.log("Sending access email for existing user:", email);
      const { data: linkData, error: linkErr } = await admin.auth.admin.generateLink({ type: 'recovery', email, options: { redirectTo: passwordRedirectTo } });
      if (linkErr || !linkData?.properties?.action_link) {
        return new Response(JSON.stringify({ success: false, error: linkErr?.message ?? "Failed to generate access link" }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      }

      try {
        await sendViaGmailApi(email, "Set your EventPix password", `
          <h2>Welcome to EventPix</h2>
          <p>Click the link below to set your password and access your account:</p>
          <p><a href="${linkData.properties.action_link}" style="background-color: #3b82f6; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; display: inline-block;">Set My Password</a></p>
          <p><strong>Before you get started:</strong> Check out our <a href="https://app.eventpix.com.au/onboarding">Team Onboarding Guide</a>.</p>
          <hr><p>Looking forward to working with you,<br><strong>Trevor Connell</strong><br>EventPix Operations</p>
        `);
        await admin.from("email_logs").insert({ email_type: "team_invite", recipient_email: email, recipient_name: email, subject: "Set your EventPix password", body_preview: "Set your EventPix password", status: "sent", sent_at: new Date().toISOString(), direction: "outbound" }).then(({ error: logErr }) => { if (logErr) console.error("Failed to log email:", logErr); });
      } catch (emailErr) {
        console.error("Failed to send email:", emailErr);
        return new Response(JSON.stringify({ success: false, error: "Failed to send email" }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      }

      return new Response(JSON.stringify({ success: true, user_id: resend_access_for_user_id }), { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    // Original invitation flow
    const { data: inv, error: invErr } = await admin.from("user_invitations").select("id, email, role, status, staff_id").eq("id", invitation_id).single();
    if (invErr || !inv) return new Response(JSON.stringify({ success: false, error: "Invitation not found" }), { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    if (inv.status === "accepted") return new Response(JSON.stringify({ success: false, error: "Invitation already accepted" }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    if (inv.status === "revoked") return new Response(JSON.stringify({ success: false, error: "Invitation has been revoked" }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

    let existingUser = null;
    try {
      const { data: usersData } = await admin.auth.admin.listUsers({ page: 1, perPage: 1000 });
      existingUser = usersData?.users?.find((u: { email?: string }) => u.email?.toLowerCase() === inv.email.toLowerCase());
    } catch (e) { console.log("Error checking for existing user:", e); }

    let userId: string;

    if (existingUser) {
      console.log("User already exists, generating new invite link for:", inv.email);
      const { data: linkData, error: linkErr } = await admin.auth.admin.generateLink({ type: 'recovery', email: inv.email, options: { redirectTo: passwordRedirectTo } });
      if (linkErr || !linkData?.properties?.action_link) {
        await admin.from("user_invitations").update({ status: "failed", error: linkErr?.message ?? "Failed to generate invite link", updated_at: new Date().toISOString() }).eq("id", invitation_id);
        return new Response(JSON.stringify({ success: false, error: linkErr?.message ?? "Failed to generate invite link" }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      }
      userId = existingUser.id;
      try {
        await sendViaGmailApi(inv.email, "Set your EventPix password", `
          <h2>Welcome to EventPix</h2>
          <p>Click the link below to set your password and access your account:</p>
          <p><a href="${linkData.properties.action_link}" style="background-color: #3b82f6; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; display: inline-block;">Set My Password</a></p>
          <p><strong>Before you get started:</strong> Check out our <a href="https://app.eventpix.com.au/onboarding">Team Onboarding Guide</a>.</p>
          <hr><p>Looking forward to working with you,<br><strong>Trevor Connell</strong><br>EventPix Operations</p>
        `);
        await admin.from("email_logs").insert({ email_type: "team_invite", recipient_email: inv.email, recipient_name: inv.email, subject: "Set your EventPix password", body_preview: "Set your EventPix password", status: "sent", sent_at: new Date().toISOString(), direction: "outbound" }).then(({ error: logErr }) => { if (logErr) console.error("Failed to log email:", logErr); });
      } catch (emailErr) { console.error("Failed to send email via Gmail:", emailErr); }
    } else {
      const { data: linkData, error: linkErr } = await admin.auth.admin.generateLink({ type: 'invite', email: inv.email, options: { redirectTo: inviteRedirectTo, data: { role: inv.role } } });
      if (linkErr || !linkData?.user) {
        await admin.from("user_invitations").update({ status: "failed", error: linkErr?.message ?? "Unknown error creating user", updated_at: new Date().toISOString() }).eq("id", invitation_id);
        return new Response(JSON.stringify({ success: false, error: linkErr?.message ?? "Failed to create user" }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      }
      userId = linkData.user.id;
      try {
        await sendViaGmailApi(inv.email, "You're invited to join EventPix", `
          <h2>Welcome to EventPix!</h2>
          <p>You've been invited to join the EventPix team as <strong>${inv.role}</strong>.</p>
          <p>Click the button below to set up your account:</p>
          <p><a href="${linkData.properties.action_link}" style="background-color: #3b82f6; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; display: inline-block;">Accept Invitation</a></p>
          <p><strong>Before you get started:</strong> Check out our <a href="https://app.eventpix.com.au/onboarding">Team Onboarding Guide</a>.</p>
          <hr><p>Looking forward to working with you,<br><strong>Trevor Connell</strong><br>EventPix Operations</p>
        `);
        await admin.from("email_logs").insert({ email_type: "team_invite", recipient_email: inv.email, recipient_name: inv.email, subject: "You're invited to join EventPix", body_preview: `Invited to join EventPix as ${inv.role}`, status: "sent", sent_at: new Date().toISOString(), direction: "outbound" }).then(({ error: logErr }) => { if (logErr) console.error("Failed to log email:", logErr); });
      } catch (emailErr) { console.error("Failed to send invite email:", emailErr); }
    }

    // Link staff record and set up profile
    let staffData: { name?: string; phone?: string; notes?: string; location?: string; role?: string } | null = null;
    if (inv.staff_id) {
      const { data: staff, error: staffErr } = await admin.from("staff").select("name, phone, notes, location, role").eq("id", inv.staff_id).single();
      if (!staffErr && staff) { staffData = staff; console.log("Found linked staff record:", staffData); }
    }

    let defaultRoleId: string | null = null;
    if (staffData?.role) {
      const roleName = staffData.role.toLowerCase();
      const searchName = roleName === 'assistant' ? 'Assistant' : roleName === 'videographer' ? 'Videographer' : 'Photographer';
      const { data: roleRow, error: roleSearchErr } = await admin.from("staff_roles").select("id").eq("name", searchName).maybeSingle();
      if (roleRow && !roleSearchErr) { defaultRoleId = roleRow.id; console.log(`Mapped staff role '${staffData.role}' to staff_role id: ${defaultRoleId}`); }
    }

    const { error: profErr } = await admin.from("profiles").upsert({
      id: userId, email: inv.email, full_name: staffData?.name || null, phone: staffData?.phone || null,
      notes_internal: staffData?.notes || null, home_city: staffData?.location || null,
      default_role_id: defaultRoleId, is_active: true, onboarding_status: 'incomplete', updated_at: new Date().toISOString(),
    });

    if (profErr) {
      console.error("Profile upsert error:", profErr);
      await admin.from("user_invitations").update({ status: "failed", auth_user_id: userId, error: profErr.message, updated_at: new Date().toISOString() }).eq("id", invitation_id);
      return new Response(JSON.stringify({ success: false, error: profErr.message }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    if (inv.staff_id) {
      const { error: staffUpdateErr } = await admin.from("staff").update({ user_id: userId }).eq("id", inv.staff_id);
      if (staffUpdateErr) console.error("Failed to link staff record:", staffUpdateErr);
      else console.log("Linked staff record", inv.staff_id, "to user", userId);
    }

    const { error: roleInsertErr } = await admin.from("user_roles").upsert({ user_id: userId, role: inv.role });
    if (roleInsertErr) console.error("Role insert error:", roleInsertErr);

    await admin.from("user_invitations").update({ status: "emailed", auth_user_id: userId, error: null, updated_at: new Date().toISOString() }).eq("id", invitation_id);
    console.log("User created successfully:", userId);

    return new Response(JSON.stringify({ success: true, user_id: userId }), { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  } catch (e) {
    console.error("Unexpected error:", e);
    return new Response(JSON.stringify({ success: false, error: String(e) }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }
});
