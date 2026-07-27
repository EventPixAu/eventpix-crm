import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

function renderMergeFields(html: string, ctx: Record<string, any>): string {
  let out = html;
  const p = ctx.photographer || {};
  const c = ctx.contract || {};
  const map: Record<string, string> = {
    "photographer.name": p.name || "",
    "photographer.first_name": (p.name || "").split(" ")[0] || "",
    "photographer.business_name": p.business_name || "",
    "photographer.abn": p.abn || "",
    "photographer.email": p.email || "",
    "photographer.phone": p.phone || "",
    "photographer.address": p.address || "",
    "photographer.state": p.state || "",
    "contract.created_date": c.created_date || "",
    "contract.template_name": c.template_name || "",
    "contract.expiry_date": c.expiry_date || "",
    "signing_link": ctx.signing_link || "",
    "today": c.created_date || "",
    "company_name": "EventPix",
  };
  for (const [k, v] of Object.entries(map)) {
    out = out.replace(new RegExp("\\{\\{\\s*" + k.replace(/\./g, "\\.") + "\\s*\\}\\}", "g"), v);
  }
  return out;
}

function buildPhotographerContext(profile: any) {
  const addressParts = [profile.address_line1, profile.address_line2, profile.address_city, profile.address_state, profile.address_postcode].filter(Boolean);
  const today = new Date().toLocaleDateString("en-AU", { day: "numeric", month: "long", year: "numeric" });
  return {
    photographer: {
      name: profile.full_name || profile.email,
      business_name: profile.business_name || "",
      abn: profile.abn || "",
      email: profile.email || "",
      phone: profile.phone || "",
      address: addressParts.join(", "),
      state: profile.address_state || profile.home_state || "",
    },
    contract: { created_date: today },
  };
}

async function getGmailAccessToken(): Promise<string> {
  const clientId = Deno.env.get("GMAIL_CLIENT_ID");
  const clientSecret = Deno.env.get("GMAIL_CLIENT_SECRET");
  const refreshToken = Deno.env.get("GMAIL_REFRESH_TOKEN");
  if (!clientId || !clientSecret || !refreshToken) throw new Error("Gmail OAuth2 not configured");
  const resp = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ client_id: clientId, client_secret: clientSecret, refresh_token: refreshToken, grant_type: "refresh_token" }),
  });
  if (!resp.ok) throw new Error(`Gmail token refresh failed: ${await resp.text()}`);
  return (await resp.json()).access_token;
}

function base64UrlEncode(str: string): string {
  return btoa(unescape(encodeURIComponent(str))).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

async function sendGmail(to: string, subject: string, html: string): Promise<string> {
  const token = await getGmailAccessToken();
  const mime = [
    `From: "EventPix" <pix@eventpix.com.au>`,
    `To: ${to}`,
    `Subject: =?UTF-8?B?${btoa(unescape(encodeURIComponent(subject)))}?=`,
    "MIME-Version: 1.0",
    "Content-Type: text/html; charset=UTF-8",
    "Content-Transfer-Encoding: base64",
    "",
    btoa(unescape(encodeURIComponent(html))),
  ].join("\r\n");
  const resp = await fetch("https://gmail.googleapis.com/gmail/v1/users/me/messages/send", {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify({ raw: base64UrlEncode(mime) }),
  });
  if (!resp.ok) throw new Error(`Gmail send failed: ${await resp.text()}`);
  return (await resp.json()).id || "sent";
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });

    const userClient = createClient(supabaseUrl, anonKey, { global: { headers: { Authorization: authHeader } } });
    const { data: claimsData, error: claimsErr } = await userClient.auth.getClaims(authHeader.replace("Bearer ", ""));
    if (claimsErr || !claimsData?.claims) return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    const userId = claimsData.claims.sub;

    const admin = createClient(supabaseUrl, serviceKey);
    const { data: isAdmin } = await admin.rpc("has_role", { _user_id: userId, _role: "admin" });
    if (!isAdmin) return new Response(JSON.stringify({ error: "Admin only" }), { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } });

    const body = await req.json();
    const action = body.action || "preview"; // preview | send | resend | cancel | regenerate | preview_email
    const photographerId: string | undefined = body.photographerId;
    const templateId: string | undefined = body.templateId;
    const contractId: string | undefined = body.contractId;
    const emailTemplateId: string | undefined = body.emailTemplateId;
    const publicBaseUrl: string = body.publicBaseUrl || "https://app.eventpix.com.au";

    if (action === "cancel") {
      if (!contractId) return new Response(JSON.stringify({ error: "contractId required" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      await admin.from("photographer_contracts").update({ status: "cancelled", cancelled_at: new Date().toISOString(), signing_token: null }).eq("id", contractId);
      await admin.from("photographer_contract_audit").insert({ contract_id: contractId, event_type: "cancelled", created_by_user_id: userId });
      return new Response(JSON.stringify({ success: true }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    if (!photographerId) return new Response(JSON.stringify({ error: "photographerId required" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });

    const { data: profile, error: profileErr } = await admin.from("profiles").select("*").eq("id", photographerId).maybeSingle();
    if (profileErr || !profile) return new Response(JSON.stringify({ error: "Photographer not found" }), { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } });

    // Pick contract template
    let template: any = null;
    if (templateId) {
      const { data } = await admin.from("contract_templates").select("*").eq("id", templateId).maybeSingle();
      template = data;
    }
    if (!template) {
      const { data } = await admin.from("contract_templates").select("*").eq("scope", "photographer").eq("is_active", true).order("created_at", { ascending: true }).limit(1).maybeSingle();
      template = data;
    }
    if (!template) return new Response(JSON.stringify({ error: "No Photographer Services Agreement template found" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });

    const ctx: any = buildPhotographerContext(profile);
    ctx.contract.template_name = template.name;
    const rendered = renderMergeFields(template.body_html, ctx);

    // Optional email template lookup (for preview & send)
    let emailTemplate: any = null;
    if (emailTemplateId) {
      const { data } = await admin.from("email_templates").select("*").eq("id", emailTemplateId).maybeSingle();
      emailTemplate = data;
    }

    if (action === "preview") {
      return new Response(JSON.stringify({ success: true, rendered_html: rendered, template_name: template.name, photographer: ctx.photographer }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    if (action === "preview_email") {
      const placeholderLink = `${publicBaseUrl}/sign/photographer-agreement/PREVIEW-TOKEN`;
      const emCtx = { ...ctx, signing_link: placeholderLink };
      const subject = emailTemplate ? renderMergeFields(emailTemplate.subject || "", emCtx) : "EventPix Photographer Services Agreement for signature";
      const bodyHtml = emailTemplate ? renderMergeFields(emailTemplate.body_html || "", emCtx) : "";
      return new Response(JSON.stringify({ success: true, subject, body_html: bodyHtml, signing_link: placeholderLink, template_name: emailTemplate?.name || null }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // Find/create the contract row
    let existing: any = null;
    if (contractId) {
      const { data } = await admin.from("photographer_contracts").select("*").eq("id", contractId).maybeSingle();
      existing = data;
    } else {
      const { data } = await admin.from("photographer_contracts").select("*").eq("photographer_id", photographerId).in("status", ["draft", "sent", "viewed"]).order("created_at", { ascending: false }).limit(1).maybeSingle();
      existing = data;
    }

    const nowIso = new Date().toISOString();
    const expiresIso = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();

    let row: any;
    if (existing && existing.status !== "signed" && existing.status !== "cancelled") {
      const regenerate = action === "regenerate";
      const patch: any = {
        status: "sent",
        sent_at: nowIso,
        signing_token_expires_at: expiresIso,
        template_id: template.id,
        template_name: template.name,
        email_template_id: emailTemplate?.id || null,
        email_template_name: emailTemplate?.name || null,
      };
      if (regenerate) patch.rendered_html = rendered;
      if (!existing.signing_token || (existing.signing_token_expires_at && new Date(existing.signing_token_expires_at) < new Date())) {
        patch.signing_token = crypto.randomUUID();
      }
      const { data } = await admin.from("photographer_contracts").update(patch).eq("id", existing.id).select().single();
      row = data;
    } else {
      const { data } = await admin.from("photographer_contracts").insert({
        photographer_id: photographerId,
        template_id: template.id,
        template_name: template.name,
        rendered_html: rendered,
        status: "sent",
        sent_at: nowIso,
        signing_token: crypto.randomUUID(),
        signing_token_expires_at: expiresIso,
        created_by: userId,
        email_template_id: emailTemplate?.id || null,
        email_template_name: emailTemplate?.name || null,
      }).select().single();
      row = data;
    }

    const signingLink = `${publicBaseUrl}/sign/photographer-agreement/${row.signing_token}`;
    ctx.signing_link = signingLink;
    ctx.contract.expiry_date = new Date(expiresIso).toLocaleDateString("en-AU", { day: "numeric", month: "long", year: "numeric" });

    let emailSubject = "EventPix Photographer Services Agreement for signature";
    let emailBody: string;
    if (emailTemplate) {
      emailSubject = renderMergeFields(emailTemplate.subject || emailSubject, ctx);
      emailBody = renderMergeFields(emailTemplate.body_html || "", ctx);
    } else {
      emailBody = `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; color: #111;">
          <p>Hi ${ctx.photographer.name.split(" ")[0] || ctx.photographer.name},</p>
          <p>Please review and sign the EventPix Photographer Services Agreement.</p>
          <p>You can view and sign the agreement here:</p>
          <p style="text-align:center; margin: 24px 0;">
            <a href="${signingLink}" style="background:#000; color:#fff; padding:12px 24px; border-radius:6px; text-decoration:none; display:inline-block;">Review &amp; Sign Agreement</a>
          </p>
          <p style="font-size:12px; color:#666;">Or copy this link: ${signingLink}</p>
          <p>Kind regards,<br/>EventPix</p>
        </div>
      `;
    }

    if (!profile.email) return new Response(JSON.stringify({ error: "Photographer has no email address" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });

    await sendGmail(profile.email, emailSubject, emailBody);
    await admin.from("photographer_contract_audit").insert({ contract_id: row.id, event_type: action === "resend" ? "resent" : "sent", created_by_user_id: userId, event_description: emailTemplate?.name || null });

    return new Response(JSON.stringify({ success: true, contract: row, signing_link: signingLink }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (e) {
    console.error(e);
    return new Response(JSON.stringify({ error: (e as Error).message }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
