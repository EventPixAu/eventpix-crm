// Sends the next pending step of a campaign via Resend (bulk).
// Iterates campaign_contacts that have not received the current step yet,
// skipping unsubscribed contacts, and logs to email_logs + contact_activities.
import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const RESEND_FROM = "EventPix <pix@rs.eventpix.com.au>";

interface SendCampaignStepBody {
  campaignId: string;
  stepOrder?: number; // defaults to campaigns.current_step
}

function applyMergeFields(template: string, ctx: {
  firstName: string;
  fullName: string;
  company: string;
  lastEventName: string;
  lastEventDate: string;
  unsubscribeUrl: string;
}): string {
  return template
    .replace(/\{\{\s*First Name\s*\}\}/gi, ctx.firstName || "")
    .replace(/\{\{\s*Name\s*\}\}/gi, ctx.firstName || "")
    .replace(/\{\{\s*Full Name\s*\}\}/gi, ctx.fullName || "")
    .replace(/\{\{\s*Company\s*\}\}/gi, ctx.company || "")
    .replace(/\{\{\s*Last Event\s*\}\}/gi, ctx.lastEventName
      ? `${ctx.lastEventName}${ctx.lastEventDate ? ` (${ctx.lastEventDate})` : ""}`
      : "")
    .replace(/\{\{\s*Unsubscribe\s*\}\}/gi, ctx.unsubscribeUrl);
}

function buildCampaignFooter(unsubscribeUrl: string, supabaseUrl: string): string {
  const logoUrl = `${supabaseUrl}/storage/v1/object/public/avatars/email-logo.png`;
  return `
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-top:32px;border-top:1px solid #e5e7eb;">
      <tr>
        <td style="padding:24px 16px 16px;text-align:center;font-family:Arial,Helvetica,sans-serif;font-size:12px;color:#9ca3af;line-height:1.6;">
          <img src="${logoUrl}" alt="EventPix" width="120" style="display:block;margin:0 auto 12px;" />
          <p style="margin:0 0 8px;font-weight:600;color:#6b7280;">Event Photography Australia-wide</p>
          <p style="margin:0 0 4px;">5 Chelsea Close, Balmoral NSW 2283</p>
          <p style="margin:0 0 4px;">Phone: 1300 850 021</p>
          <p style="margin:0 0 12px;">
            <a href="https://eventpix.com.au" style="color:#6b7280;text-decoration:underline;">eventpix.com.au</a>
          </p>
          <p style="margin:0;font-size:11px;color:#9ca3af;">
            You're receiving this email because you've worked with EventPix.
            <br/>
            <a href="${unsubscribeUrl}" style="color:#6b7280;text-decoration:underline;">Unsubscribe from this list</a>
          </p>
        </td>
      </tr>
    </table>
  `;
}

async function sendViaResend(to: string, subject: string, html: string): Promise<{ id: string }> {
  const apiKey = Deno.env.get("RESEND_API_KEY");
  if (!apiKey) throw new Error("RESEND_API_KEY not configured");
  const resp = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({ from: RESEND_FROM, to: [to], subject, html }),
  });
  if (!resp.ok) {
    const err = await resp.text();
    throw new Error(`Resend ${resp.status}: ${err}`);
  }
  return await resp.json();
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, serviceKey);

    // Allow internal cron dispatch via shared secret, otherwise require user auth + role
    const cronSecret = Deno.env.get("CRON_SECRET");
    const providedCron = req.headers.get("x-cron-secret");
    const isCron = !!cronSecret && providedCron === cronSecret;

    let actorUserId: string | null = null;
    if (!isCron) {
      const auth = req.headers.get("Authorization");
      if (!auth) return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: corsHeaders });
      const { data: userData } = await supabase.auth.getUser(auth.replace("Bearer ", ""));
      if (!userData.user) return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: corsHeaders });

      const { data: roles } = await supabase.from("user_roles").select("role").eq("user_id", userData.user.id);
      const allowed = new Set(["admin", "sales", "operations"]);
      if (!(roles || []).some((r: { role: string }) => allowed.has(r.role))) {
        return new Response(JSON.stringify({ error: "Forbidden" }), { status: 403, headers: corsHeaders });
      }
      actorUserId = userData.user.id;
    }

    const body: SendCampaignStepBody = await req.json();
    if (!body.campaignId) return new Response(JSON.stringify({ error: "campaignId required" }), { status: 400, headers: corsHeaders });

    const { data: campaign, error: campErr } = await supabase
      .from("email_campaigns")
      .select("*")
      .eq("id", body.campaignId)
      .maybeSingle();
    if (campErr || !campaign) throw new Error(campErr?.message || "Campaign not found");

    const stepOrder = body.stepOrder ?? campaign.current_step ?? 0;

    const { data: step } = await supabase
      .from("email_campaign_steps")
      .select("*")
      .eq("campaign_id", campaign.id)
      .eq("step_order", stepOrder)
      .maybeSingle();
    if (!step) throw new Error(`Step ${stepOrder} not found`);

    // Get recipients
    const { data: recipients } = await supabase
      .from("campaign_contacts")
      .select("*, client_contacts(id, first_name, last_name, contact_name, unsubscribed, client_id, clients(business_name))")
      .eq("campaign_id", campaign.id);

    // Update campaign to in_progress
    await supabase.from("email_campaigns")
      .update({ status: "in_progress", current_step: stepOrder })
      .eq("id", campaign.id);

    const publicBase = Deno.env.get("PUBLIC_BASE_URL") || "https://app.eventpix.com.au";
    let sent = 0, failed = 0, skipped = 0;

    for (const rec of (recipients || [])) {
      // Already sent this step?
      const { data: existingSend } = await supabase
        .from("campaign_step_sends")
        .select("id, status")
        .eq("campaign_contact_id", rec.id)
        .eq("step_id", step.id)
        .maybeSingle();
      if (existingSend && existingSend.status === "sent") continue;

      const cc = rec.client_contacts as { unsubscribed?: boolean; first_name?: string; last_name?: string; contact_name?: string; clients?: { business_name?: string } } | null;

      // Skip unsubscribed
      if (cc?.unsubscribed) {
        await supabase.from("campaign_step_sends").upsert({
          campaign_contact_id: rec.id,
          step_id: step.id,
          status: "skipped",
          error_message: "Recipient unsubscribed",
        }, { onConflict: "campaign_contact_id,step_id" });
        skipped++;
        continue;
      }

      // For sequence steps >0, skip if a prior reply was logged
      if (stepOrder > 0 && rec.contact_id) {
        const { data: replies } = await supabase
          .from("email_logs")
          .select("id")
          .eq("contact_id", rec.contact_id)
          .eq("email_type", "inbound_reply")
          .limit(1);
        if (replies && replies.length > 0) {
          await supabase.from("campaign_step_sends").upsert({
            campaign_contact_id: rec.id,
            step_id: step.id,
            status: "skipped",
            error_message: "Recipient replied",
          }, { onConflict: "campaign_contact_id,step_id" });
          skipped++;
          continue;
        }
      }

      const firstName = (cc?.first_name || (cc?.contact_name || rec.recipient_name || "").split(" ")[0] || "").trim();
      const fullName = cc?.contact_name || rec.recipient_name || "";
      const company = cc?.clients?.business_name || "";
      const unsubscribeUrl = `${publicBase}/unsubscribe?email=${encodeURIComponent(rec.recipient_email)}&c=${campaign.id}`;

      const ctx = {
        firstName,
        fullName,
        company,
        lastEventName: rec.last_event_name || "",
        lastEventDate: rec.last_event_date || "",
        unsubscribeUrl,
      };

      const subject = applyMergeFields(step.subject, ctx);
      const html = applyMergeFields(step.body_html, ctx) + buildCampaignFooter(unsubscribeUrl, supabaseUrl);

      // Log first
      const { data: logRow } = await supabase.from("email_logs").insert({
        email_type: "campaign",
        recipient_email: rec.recipient_email,
        recipient_name: fullName || null,
        subject,
        body_html: html,
        body_preview: html.replace(/<[^>]*>/g, "").substring(0, 200),
        status: "pending",
        sent_by: actorUserId ?? campaign.created_by,
        contact_id: rec.contact_id,
        client_id: rec.client_id,
      }).select("id").maybeSingle();

      try {
        const result = await sendViaResend(rec.recipient_email, subject, html);
        await supabase.from("campaign_step_sends").upsert({
          campaign_contact_id: rec.id,
          step_id: step.id,
          status: "sent",
          sent_at: new Date().toISOString(),
          email_log_id: logRow?.id ?? null,
        }, { onConflict: "campaign_contact_id,step_id" });

        if (logRow?.id) {
          await supabase.from("email_logs").update({
            status: "sent",
            sent_at: new Date().toISOString(),
          }).eq("id", logRow.id);
        }

        // Activity timeline
        if (rec.contact_id) {
          await supabase.from("contact_activities").insert({
            contact_id: rec.contact_id,
            activity_type: "email",
            activity_date: new Date().toISOString(),
            subject: `[Campaign: ${campaign.name}] ${subject}`,
            notes: `Step ${stepOrder + 1} sent to ${rec.recipient_email}`,
            created_by: actorUserId ?? campaign.created_by,
          });
        }

        // Mark parent row as sent for step 0
        if (stepOrder === 0) {
          await supabase.from("campaign_contacts").update({
            status: "sent",
            sent_at: new Date().toISOString(),
            email_log_id: logRow?.id ?? null,
          }).eq("id", rec.id);
        }

        sent++;
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        await supabase.from("campaign_step_sends").upsert({
          campaign_contact_id: rec.id,
          step_id: step.id,
          status: "failed",
          error_message: msg,
        }, { onConflict: "campaign_contact_id,step_id" });
        if (logRow?.id) {
          await supabase.from("email_logs").update({ status: "failed", error_message: msg }).eq("id", logRow.id);
        }
        if (stepOrder === 0) {
          await supabase.from("campaign_contacts").update({ status: "failed", error_message: msg }).eq("id", rec.id);
        }
        failed++;
      }
    }

    // Update campaign counters & status
    const { count: stepCount } = await supabase
      .from("email_campaign_steps")
      .select("*", { count: "exact", head: true })
      .eq("campaign_id", campaign.id);

    const isLastStep = stepOrder + 1 >= (stepCount || 1);
    const updates: Record<string, unknown> = {
      sent_count: (campaign.sent_count || 0) + sent,
      failed_count: (campaign.failed_count || 0) + failed,
    };
    if (stepOrder === 0) {
      updates.total_recipients = (recipients || []).length;
    }
    if (isLastStep && !campaign.is_sequence) updates.status = "completed";
    else if (isLastStep) updates.status = "completed";
    else updates.current_step = stepOrder + 1;

    await supabase.from("email_campaigns").update(updates).eq("id", campaign.id);

    return new Response(JSON.stringify({ success: true, sent, failed, skipped, stepOrder }), {
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
