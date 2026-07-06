import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { Webhook } from "https://esm.sh/svix@1.21.0";

/**
 * Inbound Email Webhook
 *
 * Receives `email.received` payloads from Resend inbound routing and logs them
 * as inbound email_logs entries. Also:
 *   - Detects auto-replies (Out of office / Automatic reply / Auto-response)
 *     and flags them so they are NOT counted as campaign replies.
 *   - Matches inbound subject to a prior outbound campaign send and marks the
 *     matching campaign_contact / campaign_step_send as 'replied'.
 *   - Appends an entry to contact_activities.
 *
 * Signature is verified using RESEND_WEBHOOK_SECRET (Svix). If your inbound
 * webhook uses a different secret in Resend, also configure it with the same
 * value or extend this file to support a second secret.
 */

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, svix-id, svix-timestamp, svix-signature",
};

function parseAddress(input: string | undefined | null): { email: string; name: string | null } {
  const s = (input ?? "").toString().trim();
  if (!s) return { email: "", name: null };
  const m = s.match(/^(?:"?(.+?)"?\s*<)?([^<>]+)>?$/);
  return {
    email: (m?.[2] ?? s).trim().toLowerCase(),
    name: m?.[1]?.trim() || null,
  };
}

function normalizeSubject(subject: string | undefined | null): string {
  let s = (subject ?? "").trim();
  // Strip "Re:", "Fwd:", "Fw:", "Aw:", "Antw:", "Tr:" prefixes (repeated)
  for (let i = 0; i < 5; i++) {
    const next = s.replace(/^\s*(re|fw|fwd|aw|antw|tr)\s*(\[\d+\])?\s*:\s*/i, "");
    if (next === s) break;
    s = next;
  }
  return s.trim().toLowerCase();
}

function isAutoReplySubject(subject: string | undefined | null): boolean {
  const s = (subject ?? "").toLowerCase();
  return (
    s.includes("automatic reply") ||
    s.includes("out of office") ||
    s.includes("out-of-office") ||
    /\booo\b/.test(s) ||
    s.includes("auto-response") ||
    s.includes("auto response") ||
    s.includes("autoreply") ||
    s.includes("auto-reply")
  );
}

function isNoReplySender(email: string | undefined | null): boolean {
  const local = (email ?? "").toLowerCase().split("@")[0] || "";
  return /^(no[-_.]?reply|do[-_.]?not[-_.]?reply|noreply|donotreply|mailer[-_.]?daemon|postmaster|notifications?|bounce|bounces)$/.test(
    local,
  );
}

function detectAutoReply(
  subject: string | undefined | null,
  fromEmail: string | undefined | null,
): boolean {
  return isAutoReplySubject(subject) || isNoReplySender(fromEmail);
}

async function isInternalEmail(supabase: any, email: string): Promise<boolean> {
  const e = (email || "").toLowerCase().trim();
  if (!e) return false;
  try {
    const { data } = await supabase
      .from("site_settings")
      .select("key, value")
      .in("key", ["owner_email", "internal_email_domains"]);
    const map: Record<string, string> = {};
    for (const r of data ?? []) map[r.key] = (r.value ?? "").toLowerCase();
    const owner = (map.owner_email || "trevor@eventpix.com.au").trim();
    if (owner && e === owner) return true;
    const domains = (map.internal_email_domains || "eventpix.com.au")
      .split(",").map((d: string) => d.trim()).filter(Boolean);
    return domains.some((d) => e.endsWith("@" + d) || e === d);
  } catch {
    return e.endsWith("@eventpix.com.au");
  }
}

const APP_BASE_URL = "https://app.eventpix.com.au";
const RESEND_FROM = "EventPix Alerts <pix@rs.eventpix.com.au>";

function escapeHtml(s: string): string {
  return (s || "").replace(/[&<>"']/g, (c) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
  }[c]!));
}

async function getOwnerEmail(supabase: any): Promise<string> {
  try {
    const { data } = await supabase.from("site_settings")
      .select("value").eq("key", "owner_email").maybeSingle();
    return ((data?.value as string) || "trevor@eventpix.com.au").trim();
  } catch {
    return "trevor@eventpix.com.au";
  }
}

async function isFirstReplyForThread(
  supabase: any,
  params: { fromEmail: string; currentInboundId: string; originalId: string | null; campaignContactId: string | null },
): Promise<boolean> {
  const { fromEmail, currentInboundId, originalId, campaignContactId } = params;
  let relatedIds: string[] = [];
  if (campaignContactId) {
    const { data: sends } = await supabase
      .from("campaign_step_sends").select("email_log_id")
      .eq("campaign_contact_id", campaignContactId);
    relatedIds = (sends ?? []).map((s: any) => s.email_log_id).filter(Boolean);
    const { data: cc } = await supabase
      .from("campaign_contacts").select("email_log_id")
      .eq("id", campaignContactId).maybeSingle();
    if (cc?.email_log_id && !relatedIds.includes(cc.email_log_id)) relatedIds.push(cc.email_log_id);
  } else if (originalId) {
    relatedIds = [originalId];
  } else {
    return true;
  }
  if (relatedIds.length === 0) return true;
  const { count } = await supabase
    .from("email_logs")
    .select("id", { count: "exact", head: true })
    .eq("direction", "inbound")
    .eq("email_type", "inbound_reply")
    .ilike("from_email", fromEmail)
    .neq("id", currentInboundId)
    .in("in_reply_to", relatedIds);
  return (count ?? 0) === 0;
}

async function sendReplyAlertEmail(
  supabase: any,
  params: {
    fromEmail: string;
    fromName: string | null;
    subject: string;
    bodyText: string | null;
    campaignName: string | null;
    contactId: string | null;
  },
): Promise<void> {
  const apiKey = Deno.env.get("RESEND_API_KEY");
  if (!apiKey) {
    console.warn("RESEND_API_KEY not set — skipping reply alert");
    return;
  }
  const ownerEmail = await getOwnerEmail(supabase);
  const senderLabel = params.fromName ? `${params.fromName} <${params.fromEmail}>` : params.fromEmail;
  const alertSubject = `New reply from ${params.fromName || params.fromEmail} — ${params.subject}`;
  const snippet = (params.bodyText || "").trim().slice(0, 300);
  const truncated = (params.bodyText || "").length > 300;
  const contactUrl = params.contactId ? `${APP_BASE_URL}/crm/contacts/${params.contactId}` : null;
  const inboxUrl = `${APP_BASE_URL}/crm/emails`;
  const html = `
    <div style="font-family:Arial,sans-serif;font-size:14px;color:#111;max-width:600px">
      <h2 style="margin:0 0 12px">New campaign reply received</h2>
      <p><strong>From:</strong> ${escapeHtml(senderLabel)}</p>
      ${params.campaignName ? `<p><strong>Campaign:</strong> ${escapeHtml(params.campaignName)}</p>` : ""}
      <p><strong>Subject:</strong> ${escapeHtml(params.subject)}</p>
      <div style="background:#f6f6f6;padding:12px;border-radius:6px;white-space:pre-wrap;margin:12px 0">${escapeHtml(snippet)}${truncated ? "…" : ""}</div>
      <p style="margin-top:16px">
        ${contactUrl ? `<a href="${contactUrl}" style="margin-right:12px">Open contact</a>` : ""}
        <a href="${inboxUrl}">Open CRM Inbox</a>
      </p>
    </div>`;
  try {
    const resp = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({ from: RESEND_FROM, to: [ownerEmail], subject: alertSubject, html, reply_to: params.fromEmail }),
    });
    if (!resp.ok) {
      console.error("Reply alert send failed:", resp.status, await resp.text());
    } else {
      console.log(`Reply alert sent to ${ownerEmail} for ${params.fromEmail}`);
    }
  } catch (e) {
    console.error("Reply alert error:", e);
  }
}



serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const rawBody = await req.text();

    // Optional signature verification — skipped only if no secret is configured.
    const webhookSecret = Deno.env.get("RESEND_WEBHOOK_SECRET");
    if (webhookSecret) {
      try {
        const wh = new Webhook(webhookSecret);
        wh.verify(rawBody, {
          "svix-id": req.headers.get("svix-id") ?? "",
          "svix-timestamp": req.headers.get("svix-timestamp") ?? "",
          "svix-signature": req.headers.get("svix-signature") ?? "",
        });
      } catch (e) {
        console.error("Invalid webhook signature:", e);
        return new Response(JSON.stringify({ error: "Invalid signature" }), {
          status: 401,
          headers: { "Content-Type": "application/json", ...corsHeaders },
        });
      }
    }

    const payload = JSON.parse(rawBody);
    const data = payload?.data ?? payload;
    if (!data) {
      return new Response(JSON.stringify({ error: "Invalid payload" }), {
        status: 400,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const fromRaw = Array.isArray(data.from) ? data.from[0] : data.from;
    const toRaw = Array.isArray(data.to) ? data.to[0] : data.to;
    const { email: fromEmail, name: fromName } = parseAddress(fromRaw);
    const { email: toEmail } = parseAddress(toRaw);
    const subject: string = data.subject ?? "(No Subject)";
    // Resend inbound payloads have varied across versions — accept multiple field names.
    const text: string | undefined =
      data.text ?? data.text_body ?? data.body_text ?? data.plain ?? data.body_plain ?? undefined;
    const html: string | undefined =
      data.html ?? data.html_body ?? data.body_html ?? undefined;

    if (!text && !html) {
      console.warn("Inbound email has no text or html body — payload keys:", Object.keys(data || {}));
    }

    const isAutoReply = detectAutoReply(subject, fromEmail);
    const normalizedSubject = normalizeSubject(subject);

    console.log(
      `Inbound from ${fromEmail} → ${toEmail} · subject="${subject}" · auto_reply=${isAutoReply} · text_len=${text?.length ?? 0} · html_len=${html?.length ?? 0}`,
    );

    // Internal/owner address guard — do not create or resolve CRM contacts for these
    const internal = await isInternalEmail(supabase, fromEmail);
    if (internal) {
      console.log(`Skipping CRM contact resolution: ${fromEmail} is internal/owner address`);
    }

    // Resolve related contact (skipped for internal addresses)
    const { data: contact } = internal
      ? { data: null as any }
      : await supabase
          .from("client_contacts")
          .select("id, client_id")
          .ilike("email", fromEmail)
          .maybeSingle();

    // Find the original outbound email — prefer subject match
    let original: any = null;
    if (normalizedSubject) {
      const { data: subjMatches } = await supabase
        .from("email_logs")
        .select("id, event_id, lead_id, client_id, contact_id, subject, sent_at")
        .ilike("recipient_email", fromEmail)
        .eq("direction", "outbound")
        .order("sent_at", { ascending: false })
        .limit(25);
      original =
        (subjMatches || []).find(
          (l: any) => normalizeSubject(l.subject) === normalizedSubject,
        ) || null;
    }
    if (!original) {
      const { data: latest } = await supabase
        .from("email_logs")
        .select("id, event_id, lead_id, client_id, contact_id, subject, sent_at")
        .ilike("recipient_email", fromEmail)
        .eq("direction", "outbound")
        .order("sent_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      original = latest;
    }

    const bodyPreview = text
      ? text.substring(0, 200)
      : html?.replace(/<[^>]*>/g, "").substring(0, 200) || null;

    const insertRow: Record<string, unknown> = {
      email_type: internal ? "internal" : isAutoReply ? "auto_reply" : "inbound_reply",
      direction: "inbound",
      from_email: fromEmail,
      from_name: fromName,
      recipient_email: toEmail,
      subject,
      body_html: html || null,
      body_text: text || null,
      body_preview: bodyPreview,
      status: isAutoReply ? "auto_reply" : "received",
      sent_at: new Date().toISOString(),
      // Auto-replies and internal mails do NOT carry in_reply_to so they are excluded from campaign Replied stats
      in_reply_to: isAutoReply || internal ? null : original?.id ?? null,
      contact_id: internal ? null : (contact?.id || original?.contact_id || null),
      client_id: internal ? null : (contact?.client_id || original?.client_id || null),
      event_id: internal ? null : (original?.event_id || null),
      lead_id: internal ? null : (original?.lead_id || null),
    };


    const { data: emailLog, error: logError } = await supabase
      .from("email_logs")
      .insert(insertRow)
      .select("id")
      .single();

    if (logError) {
      console.error("Failed to log inbound email:", logError);
      return new Response(
        JSON.stringify({ success: false, error: logError.message }),
        { status: 500, headers: { "Content-Type": "application/json", ...corsHeaders } },
      );
    }

    // Campaign reply matching — only for genuine (non-internal) replies
    let campaignUpdated = false;
    let matchedCampaignContactId: string | null = null;
    let matchedCampaignId: string | null = null;
    if (!isAutoReply && !internal && original) {
      const { data: stepSend } = await supabase
        .from("campaign_step_sends")
        .select("id, campaign_contact_id")
        .eq("email_log_id", original.id)
        .maybeSingle();

      if (stepSend) {
        await supabase
          .from("campaign_step_sends")
          .update({ status: "replied" })
          .eq("id", stepSend.id);
        await supabase
          .from("campaign_contacts")
          .update({ status: "replied" })
          .eq("id", stepSend.campaign_contact_id);
        campaignUpdated = true;
        matchedCampaignContactId = stepSend.campaign_contact_id;
      } else {
        const { data: cc } = await supabase
          .from("campaign_contacts")
          .select("id")
          .eq("email_log_id", original.id)
          .maybeSingle();
        if (cc) {
          await supabase
            .from("campaign_contacts")
            .update({ status: "replied" })
            .eq("id", cc.id);
          campaignUpdated = true;
          matchedCampaignContactId = cc.id;
        }
      }
      if (matchedCampaignContactId) {
        const { data: ccRow } = await supabase
          .from("campaign_contacts")
          .select("campaign_id")
          .eq("id", matchedCampaignContactId)
          .maybeSingle();
        matchedCampaignId = ccRow?.campaign_id ?? null;
      }
    }

    // Activity timeline
    const activityContactId = insertRow.contact_id as string | null;
    if (activityContactId) {
      await supabase.from("contact_activities").insert({
        contact_id: activityContactId,
        activity_type: isAutoReply ? "auto_reply" : "email",
        activity_date: new Date().toISOString(),
        subject: isAutoReply ? `Auto-reply: ${subject}` : `Reply: ${subject}`,
        notes: isAutoReply
          ? `Automatic / out-of-office response received from ${fromEmail}`
          : `Inbound reply received from ${fromEmail}` +
            (campaignUpdated ? " (matched to campaign send)" : ""),
      });
    }

    // Owner alert email — genuine, non-internal replies only, first reply per campaign/thread
    if (!isAutoReply && !internal) {
      try {
        const isFirst = await isFirstReplyForThread(supabase, {
          fromEmail,
          currentInboundId: emailLog.id,
          originalId: original?.id ?? null,
          campaignContactId: matchedCampaignContactId,
        });
        if (isFirst) {
          let campaignName: string | null = null;
          if (matchedCampaignId) {
            const { data: camp } = await supabase
              .from("email_campaigns").select("name").eq("id", matchedCampaignId).maybeSingle();
            campaignName = camp?.name ?? null;
          }
          const plainBody = text || (html ? html.replace(/<[^>]*>/g, " ").replace(/\s+/g, " ") : "");
          await sendReplyAlertEmail(supabase, {
            fromEmail,
            fromName,
            subject,
            bodyText: plainBody,
            campaignName,
            contactId: activityContactId,
          });
        } else {
          console.log(`Skipping reply alert — duplicate reply from ${fromEmail}`);
        }
      } catch (alertErr) {
        console.error("Reply alert dispatch error:", alertErr);
      }
    }


    // Light-weight auto-confirmation for staff assignments (preserved from
    // earlier behaviour) — kept disabled for auto-replies.
    if (!isAutoReply) {
      const bodyText = (text || html?.replace(/<[^>]*>/g, "") || "").toLowerCase();
      const subjectLower = subject.toLowerCase();
      const confirmKeywords = [
        "confirm", "confirmed", "available", "i can make it",
        "count me in", "will be there",
      ];
      const isConfirmation = confirmKeywords.some(
        (kw) => bodyText.includes(kw) || subjectLower.includes(kw),
      );
      if (isConfirmation) {
        const { data: profile } = await supabase
          .from("profiles")
          .select("id")
          .ilike("email", fromEmail)
          .maybeSingle();
        if (profile) {
          await supabase
            .from("event_assignments")
            .update({
              confirmation_status: "confirmed",
              confirmed_at: new Date().toISOString(),
            })
            .eq("user_id", profile.id)
            .in("confirmation_status", ["pending"]);
        }
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        email_log_id: emailLog.id,
        auto_reply: isAutoReply,
        matched: !!original,
        campaign_updated: campaignUpdated,
      }),
      { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders } },
    );
  } catch (error: unknown) {
    console.error("Error in inbound-email-webhook:", error);
    const message = error instanceof Error ? error.message : "Unknown error";
    return new Response(JSON.stringify({ success: false, error: message }), {
      status: 500,
      headers: { "Content-Type": "application/json", ...corsHeaders },
    });
  }
});
