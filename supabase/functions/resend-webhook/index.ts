import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { Webhook } from "https://esm.sh/svix@1.21.0";

/**
 * Resend Webhook Handler
 *
 * Receives delivery status events from Resend and updates email_logs accordingly.
 * Requires RESEND_WEBHOOK_SECRET env var for Svix signature verification.
 */

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, svix-id, svix-timestamp, svix-signature",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Verify Svix signature
    const webhookSecret = Deno.env.get("RESEND_WEBHOOK_SECRET");
    const rawBody = await req.text();
    if (!webhookSecret) {
      console.error("RESEND_WEBHOOK_SECRET not configured – rejecting webhook");
      return new Response(JSON.stringify({ error: "Webhook secret not configured" }),
        { status: 500, headers: { "Content-Type": "application/json", ...corsHeaders } });
    }
    try {
      const wh = new Webhook(webhookSecret);
      wh.verify(rawBody, {
        "svix-id": req.headers.get("svix-id") ?? "",
        "svix-timestamp": req.headers.get("svix-timestamp") ?? "",
        "svix-signature": req.headers.get("svix-signature") ?? "",
      });
    } catch (e) {
      console.error("Invalid webhook signature:", e);
      return new Response(JSON.stringify({ error: "Invalid signature" }),
        { status: 401, headers: { "Content-Type": "application/json", ...corsHeaders } });
    }

    const body = JSON.parse(rawBody);
    const eventType = body.type;
    const data = body.data;

    if (!eventType || !data) {
      return new Response(JSON.stringify({ error: "Invalid payload" }), {
        status: 400,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    }

    console.log(`Resend webhook received: ${eventType}`, JSON.stringify({ email_id: data.email_id, to: data.to }));

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, serviceRoleKey);

    // Resend provides email_id - but we don't store it. Match by recipient + subject + recent time window.
    // First try to find the email log by matching the Resend "to" field
    const recipientEmail = Array.isArray(data.to) ? data.to[0] : data.to;
    
    if (!recipientEmail) {
      console.log("No recipient email in webhook payload");
      return new Response(JSON.stringify({ ok: true }), {
        status: 200,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    }

    // Status priority map (higher = more significant, never downgrade)
    const statusPriority: Record<string, number> = {
      pending: 0,
      sent: 1,
      delivered: 2,
      opened: 3,
      clicked: 4,
      bounced: 5, // bounced is terminal
      failed: 5,  // failed is terminal
    };

    const now = new Date().toISOString();
    let newStatus: string | null = null;
    const updateFields: Record<string, unknown> = { updated_at: now };

    switch (eventType) {
      case "email.delivered":
        newStatus = "delivered";
        updateFields.delivered_at = data.created_at || now;
        break;
      case "email.bounced":
        newStatus = "bounced";
        updateFields.error_message = data.bounce?.message || "Email bounced";
        break;
      case "email.complained":
        newStatus = "bounced";
        updateFields.error_message = "Recipient marked as spam";
        break;
      case "email.opened":
        newStatus = "opened";
        updateFields.opened_at = data.created_at || now;
        updateFields._isOpenEvent = true; // handled below
        break;
      case "email.clicked":
        newStatus = "clicked";
        updateFields.clicked_at = data.created_at || now;
        break;
      case "email.delivery_delayed":
        // Don't change status, just log
        console.log(`Delivery delayed for ${recipientEmail}`);
        return new Response(JSON.stringify({ ok: true }), {
          status: 200,
          headers: { "Content-Type": "application/json", ...corsHeaders },
        });
      case "email.received":
      case "email.inbound": {
        const result = await handleInboundEmail(supabase, data);
        return new Response(JSON.stringify({ ok: true, ...result }), {
          status: 200,
          headers: { "Content-Type": "application/json", ...corsHeaders },
        });
      }
      default:
        console.log(`Unhandled event type: ${eventType}`);
        return new Response(JSON.stringify({ ok: true }), {
          status: 200,
          headers: { "Content-Type": "application/json", ...corsHeaders },
        });
    }

    if (!newStatus) {
      return new Response(JSON.stringify({ ok: true }), {
        status: 200,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    }

    // Find matching email logs for this recipient (most recent first)
    // Look for outbound emails sent in the last 30 days
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
    
    const { data: logs, error: fetchError } = await supabase
      .from("email_logs")
      .select("id, status, subject")
      .eq("recipient_email", recipientEmail)
      .eq("direction", "outbound")
      .gte("created_at", thirtyDaysAgo)
      .order("created_at", { ascending: false })
      .limit(5);

    if (fetchError) {
      console.error("Error fetching email logs:", fetchError);
      return new Response(JSON.stringify({ error: "DB error" }), {
        status: 500,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    }

    if (!logs || logs.length === 0) {
      console.log(`No matching email log found for ${recipientEmail}`);
      return new Response(JSON.stringify({ ok: true, matched: false }), {
        status: 200,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    }

    // Try to match by subject if available
    let targetLog = logs[0]; // default to most recent
    if (data.subject) {
      const subjectMatch = logs.find(l => l.subject === data.subject);
      if (subjectMatch) targetLog = subjectMatch;
    }

    // Check status priority - bounced/failed always overrides, otherwise only upgrade
    const currentPriority = statusPriority[targetLog.status] ?? 0;
    const newPriority = statusPriority[newStatus] ?? 0;

    // Bounced always overrides (it's a terminal/definitive status from Resend)
    const isBounce = newStatus === "bounced" || newStatus === "failed";
    
    if (!isBounce && newPriority <= currentPriority) {
      console.log(`Skipping update: ${targetLog.status} -> ${newStatus} (no upgrade)`);
      return new Response(JSON.stringify({ ok: true, skipped: true }), {
        status: 200,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    }

    updateFields.status = newStatus;

    // Handle open-specific fields: increment open_count, set first_opened_at if missing
    const isOpenEvent = updateFields._isOpenEvent === true;
    delete updateFields._isOpenEvent;
    if (isOpenEvent) {
      const { data: cur } = await supabase
        .from("email_logs")
        .select("open_count, first_opened_at")
        .eq("id", targetLog.id)
        .maybeSingle();
      updateFields.open_count = ((cur?.open_count as number) || 0) + 1;
      if (!cur?.first_opened_at) updateFields.first_opened_at = updateFields.opened_at;
    }

    const { error: updateError } = await supabase
      .from("email_logs")
      .update(updateFields)
      .eq("id", targetLog.id);

    if (updateError) {
      console.error("Error updating email log:", updateError);
      return new Response(JSON.stringify({ error: "Update failed" }), {
        status: 500,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    }

    console.log(`Updated email log ${targetLog.id}: ${targetLog.status} -> ${newStatus}`);

    // CRM contact handling for bounce / complaint events
    if (eventType === "email.bounced" || eventType === "email.complained") {
      try {
        const isHardBounce = eventType === "email.bounced";
        const bounceFlag = isHardBounce ? "bounced" : "complained";
        const dateStr = new Date(now).toISOString().slice(0, 10);
        const noteText = isHardBounce
          ? `Auto-archived: Hard bounce received from Resend on ${dateStr}`
          : `Flagged: Spam complaint received from Resend on ${dateStr}`;

        const { data: contacts } = await supabase
          .from("client_contacts")
          .select("id")
          .ilike("email", recipientEmail);

        for (const contact of contacts ?? []) {
          const update: Record<string, unknown> = {
            bounce_status: bounceFlag,
            bounced_at: now,
          };
          if (isHardBounce) {
            update.status = "Archived";
            update.archived = true;
            update.archived_at = now;
          }
          await supabase.from("client_contacts").update(update).eq("id", contact.id);

          await supabase.from("client_contact_notes").insert({
            contact_id: contact.id,
            note: noteText,
          });

          await supabase.from("contact_activities").insert({
            contact_id: contact.id,
            activity_type: "bounce",
            activity_date: now,
            subject: isHardBounce ? "Hard bounce (auto-archived)" : "Spam complaint flagged",
            notes: `${noteText}. Email: ${recipientEmail}`,
          });
        }
        console.log(`Processed ${contacts?.length ?? 0} CRM contact(s) for ${eventType} (${recipientEmail})`);
      } catch (crmErr) {
        console.error("CRM bounce handling error:", crmErr);
      }
    }

    return new Response(JSON.stringify({ ok: true, updated: targetLog.id, newStatus }), {
      status: 200,
      headers: { "Content-Type": "application/json", ...corsHeaders },
    });

  } catch (error) {
    console.error("Resend webhook error:", error);
    return new Response(JSON.stringify({ error: "Internal error" }), {
      status: 500,
      headers: { "Content-Type": "application/json", ...corsHeaders },
    });
  }
});

// ============================================================================
// Inbound email handler (Resend "email.received" / inbound forwarding events)
// ============================================================================
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
  return (subject ?? "")
    .replace(/^\s*(re|fw|fwd|aw|antw|tr)\s*(\[\d+\])?\s*:\s*/gi, "")
    .replace(/^\s*(re|fw|fwd|aw|antw|tr)\s*(\[\d+\])?\s*:\s*/gi, "")
    .trim()
    .toLowerCase();
}

function isAutoReplySubject(subject: string | undefined | null): boolean {
  const s = (subject ?? "").toLowerCase();
  return (
    s.includes("automatic reply") ||
    s.includes("out of office") ||
    s.includes("out-of-office") ||
    s.includes("auto-response") ||
    s.includes("auto response") ||
    s.includes("autoreply") ||
    s.includes("auto-reply")
  );
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

async function handleInboundEmail(supabase: any, data: any): Promise<Record<string, unknown>> {
  const fromRaw = Array.isArray(data.from) ? data.from[0] : data.from;
  const toRaw = Array.isArray(data.to) ? data.to[0] : data.to;
  const { email: fromEmail, name: fromName } = parseAddress(fromRaw);
  const { email: toEmail } = parseAddress(toRaw);
  const subject: string = data.subject ?? "(No Subject)";
  const text: string | undefined = data.text;
  const html: string | undefined = data.html;

  const isAutoReply = isAutoReplySubject(subject);
  const normalizedSubject = normalizeSubject(subject);
  const internal = await isInternalEmail(supabase, fromEmail);
  if (internal) {
    console.log(`Skipping CRM contact resolution: ${fromEmail} is internal/owner address`);
  }

  // Find related contact (skipped for internal/owner addresses)
  const { data: contact } = internal
    ? { data: null as any }
    : await supabase
        .from("client_contacts")
        .select("id, client_id")
        .ilike("email", fromEmail)
        .maybeSingle();

  // Find original outbound email — prefer subject match for accurate threading
  let original: any = null;
  if (normalizedSubject) {
    const { data: subjMatches } = await supabase
      .from("email_logs")
      .select("id, event_id, lead_id, client_id, contact_id, subject, sent_at")
      .ilike("recipient_email", fromEmail)
      .eq("direction", "outbound")
      .order("sent_at", { ascending: false })
      .limit(25);
    original = (subjMatches || []).find(
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
    body_preview: bodyPreview,
    status: isAutoReply ? "auto_reply" : "received",
    sent_at: new Date().toISOString(),
    in_reply_to: isAutoReply || internal ? null : (original?.id ?? null),
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
    return { matched: false, error: logError.message };
  }

  console.log(
    `Inbound ${isAutoReply ? "auto-reply" : "reply"} logged ${emailLog.id} from ${fromEmail}` +
      (original ? ` (in_reply_to=${original.id})` : ""),
  );

  // Campaign reply matching — only for genuine replies
  let campaignUpdated = false;
  if (!isAutoReply && original) {
    // Match campaign_step_sends row by original email_log_id
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
    } else {
      // Fallback: match campaign_contacts.email_log_id (single-step campaigns)
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
      }
    }
  }

  // Activity timeline — log for both genuine replies and auto-replies, with clear labels
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

  return {
    matched: !!original,
    auto_reply: isAutoReply,
    campaign_updated: campaignUpdated,
    email_log_id: emailLog.id,
  };
}
