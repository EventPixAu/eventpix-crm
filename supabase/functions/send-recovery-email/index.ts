import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import nodemailer from "npm:nodemailer@6";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

function createGmailTransporter() {
  const clientId = Deno.env.get("GMAIL_CLIENT_ID");
  const clientSecret = Deno.env.get("GMAIL_CLIENT_SECRET");
  const refreshToken = Deno.env.get("GMAIL_REFRESH_TOKEN");
  if (!clientId || !clientSecret || !refreshToken) {
    throw new Error("Gmail OAuth2 credentials not configured");
  }
  return nodemailer.createTransport({
    host: "smtp.gmail.com",
    port: 465,
    secure: true,
    auth: { type: "OAuth2", user: "pix@eventpix.com.au", clientId, clientSecret, refreshToken },
  });
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { email, secret } = await req.json();

    if (secret !== Deno.env.get("RECOVERY_SECRET")) {
      return new Response(
        JSON.stringify({ error: "Unauthorized" }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const admin = createClient(supabaseUrl, serviceRoleKey);

    const { data: linkData, error: linkErr } = await admin.auth.admin.generateLink({
      type: 'recovery',
      email,
      options: { redirectTo: 'https://app.eventpix.com.au/reset-password' },
    });

    if (linkErr || !linkData?.properties?.action_link) {
      return new Response(
        JSON.stringify({ error: linkErr?.message ?? "Failed to generate link" }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const transporter = createGmailTransporter();
    await transporter.sendMail({
      from: '"EventPix" <pix@eventpix.com.au>',
      to: email,
      subject: "Reset your EventPix password",
      html: `
        <h2>Password Reset</h2>
        <p>Click the button below to reset your password:</p>
        <p><a href="${linkData.properties.action_link}" style="background-color: #3b82f6; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; display: inline-block;">Reset My Password</a></p>
        <p>If you didn't request this, you can safely ignore this email.</p>
      `,
    });

    // Log to email_logs
    await admin.from("email_logs").insert({
      email_type: "password_recovery",
      recipient_email: email,
      recipient_name: email,
      subject: "Reset your EventPix password",
      body_preview: "Password reset request",
      status: "sent",
      sent_at: new Date().toISOString(),
      direction: "outbound",
    }).then(({ error: logErr }) => {
      if (logErr) console.error("Failed to log recovery email:", logErr);
    });

    return new Response(
      JSON.stringify({ success: true }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (e) {
    return new Response(
      JSON.stringify({ error: String(e) }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
