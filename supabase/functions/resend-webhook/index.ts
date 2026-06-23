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

  // Helper — Resend disables endpoints that repeatedly return non-2xx.
  // We always return 200 and surface the real outcome in the JSON body + logs.
  const ok = (extra: Record<string, unknown> = {}) =>
    new Response(JSON.stringify({ ok: true, ...extra }), {
      status: 200,
      headers: { "Content-Type": "application/json", ...corsHeaders },
    });

  try {
    // Verify Svix signature
    const webhookSecret = Deno.env.get("RESEND_WEBHOOK_SECRET");
    const rawBody = await req.text();
    if (!webhookSecret) {
      console.error("RESEND_WEBHOOK_SECRET not configured – acknowledging webhook to avoid endpoint disablement");
      return ok({ skipped: "secret_not_configured" });
    }
    try {
      const wh = new Webhook(webhookSecret);
      wh.verify(rawBody, {
        "svix-id": req.headers.get("svix-id") ?? "",
        "svix-timestamp": req.headers.get("svix-timestamp") ?? "",
        "svix-signature": req.headers.get("svix-signature") ?? "",
      });
    } catch (e) {
      console.error("Invalid webhook signature (acknowledging anyway):", e);
      return ok({ skipped: "invalid_signature" });
    }

    let body: any;
    try {
      body = JSON.parse(rawBody);
    } catch (e) {
      console.error("Invalid JSON payload (acknowledging anyway):", e);
      return ok({ skipped: "invalid_json" });
    }
    const eventType = body?.type;
    const data = body?.data;

    if (!eventType || !data) {
      console.warn("Webhook payload missing type/data — acknowledging");
      return ok({ skipped: "invalid_payload" });
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
      .select("id, status, subject, client_id, lead_id, event_id, quote_id, contract_id, contact_id, template_id, email_type, recipient_name, from_email, from_name, sent_by")
      .eq("recipient_email", recipientEmail)
      .eq("direction", "outbound")
      .gte("created_at", thirtyDaysAgo)
      .order("created_at", { ascending: false })
      .limit(10);

    if (fetchError) {
      console.error("Error fetching email logs (acknowledging anyway):", fetchError);
      return ok({ skipped: "db_fetch_error" });
    }

    if (!logs || logs.length === 0) {
      console.log(`No matching email log found for ${recipientEmail}`);
      return new Response(JSON.stringify({ ok: true, matched: false }), {
        status: 200,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    }

    // Prefer the original send row (not a prior engagement row) so subsequent
    // events always anchor back to the actual send, never to an opened/clicked
    // sibling we previously inserted.
    const sendCandidates = logs.filter((l: any) => l.status !== "clicked" && l.status !== "opened");
    const pool = sendCandidates.length ? sendCandidates : logs;
    let targetLog: any = pool[0];
    if (data.subject) {
      const subjectMatch = pool.find((l: any) => l.subject === data.subject);
      if (subjectMatch) targetLog = subjectMatch;
    }

    // CLICKED events: insert a NEW email_logs row instead of updating the
    // existing send/opened row. Opens and clicks must coexist as separate rows
    // so neither overwrites the other (Apple MPP suppresses opens but allows
    // clicks — we want both signals preserved).
    if (eventType === "email.clicked") {
      const eventAt = data.created_at || now;

      // Evaluate bot/scanner suspicion for this click.
      // Rules:
      //   (a) click within 60s of delivered → bot
      //   (b) OR no genuine human open recorded on the parent send before this click → bot
      let botSuspected = false;
      try {
        const { data: parent } = await supabase
          .from("email_logs")
          .select("delivered_at, first_opened_at, opened_at, bot_suspected")
          .eq("id", targetLog.id)
          .maybeSingle();
        const clickedMs = new Date(eventAt).getTime();
        const deliveredMs = parent?.delivered_at ? new Date(parent.delivered_at).getTime() : null;
        const firstOpen = parent?.first_opened_at || parent?.opened_at;
        const firstOpenMs = firstOpen ? new Date(firstOpen).getTime() : null;
        const openIsBot = !!parent?.bot_suspected;
        const within60s = deliveredMs !== null && (clickedMs - deliveredMs) < 60_000;
        const noHumanOpenBeforeClick =
          firstOpenMs === null || openIsBot || firstOpenMs > clickedMs;
        botSuspected = within60s || noHumanOpenBeforeClick;
      } catch (e) {
        console.error("Bot-suspect evaluation failed (defaulting to false):", e);
      }

      const { error: insertErr } = await supabase.from("email_logs").insert({
        client_id: targetLog.client_id,
        lead_id: targetLog.lead_id,
        event_id: targetLog.event_id,
        quote_id: targetLog.quote_id,
        contract_id: targetLog.contract_id,
        contact_id: targetLog.contact_id,
        template_id: targetLog.template_id,
        email_type: targetLog.email_type,
        recipient_email: recipientEmail,
        recipient_name: targetLog.recipient_name,
        from_email: targetLog.from_email,
        from_name: targetLog.from_name,
        sent_by: targetLog.sent_by,
        subject: targetLog.subject,
        status: "clicked",
        direction: "outbound",
        sent_at: eventAt,
        clicked_at: eventAt,
        click_count: 1,
        in_reply_to: targetLog.id,
        bot_suspected: botSuspected,
      });
      if (insertErr) {
        console.error("Error inserting click event log (acknowledging anyway):", insertErr);
        return ok({ skipped: "db_insert_error" });
      }
      console.log(`Inserted click event row for ${recipientEmail} (source send=${targetLog.id}, bot_suspected=${botSuspected})`);
      return new Response(JSON.stringify({ ok: true, inserted: true, eventType, bot_suspected: botSuspected }), {
        status: 200,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      });
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
        .select("open_count, first_opened_at, delivered_at, bot_suspected")
        .eq("id", targetLog.id)
        .maybeSingle();
      const newCount = ((cur?.open_count as number) || 0) + 1;
      updateFields.open_count = newCount;
      const firstOpenIso = (cur?.first_opened_at as string | null) || (updateFields.opened_at as string);
      if (!cur?.first_opened_at) updateFields.first_opened_at = updateFields.opened_at;
      // Bot suspicion: first open within 30s of delivered_at AND only one open so far.
      // Once a second open is recorded, treat as human (clear the flag).
      const deliveredAt = cur?.delivered_at as string | null;
      if (newCount > 1) {
        updateFields.bot_suspected = false;
      } else if (deliveredAt && firstOpenIso) {
        const deltaMs = new Date(firstOpenIso).getTime() - new Date(deliveredAt).getTime();
        updateFields.bot_suspected = deltaMs < 30_000;
      }
    }


    const { error: updateError } = await supabase
      .from("email_logs")
      .update(updateFields)
      .eq("id", targetLog.id);

    if (updateError) {
      console.error("Error updating email log (acknowledging anyway):", updateError);
      return ok({ skipped: "db_update_error" });
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

        // Cascade bounce to ALL campaign sequence steps for this contact —
        // mark every pending future step_send as skipped and flag campaign_contacts
        // so the dispatcher never fires another email at them.
        if (isHardBounce) {
          try {
            const contactIds = (contacts ?? []).map((c: any) => c.id).filter(Boolean);
            // 1) Find all campaign_contacts rows for this recipient (by contact_id or raw email)
            let ccRows: any[] = [];
            if (contactIds.length) {
              const { data } = await supabase
                .from("campaign_contacts")
                .select("id, campaign_id, status")
                .in("contact_id", contactIds);
              ccRows = data ?? [];
            }
            const { data: byEmail } = await supabase
              .from("campaign_contacts")
              .select("id, campaign_id, status")
              .ilike("recipient_email", recipientEmail);
            for (const r of byEmail ?? []) {
              if (!ccRows.find((x) => x.id === r.id)) ccRows.push(r);
            }

            // 2) Flag parent rows as bounced so future dispatcher runs skip them
            const toFlag = ccRows
              .filter((r) => !["bounced", "unsubscribed", "replied"].includes(r.status))
              .map((r) => r.id);
            if (toFlag.length) {
              await supabase.from("campaign_contacts")
                .update({ status: "bounced", error_message: "Hard bounce received from Resend" })
                .in("id", toFlag);
            }

            // 3) Mark every pending step_send (current + future) as skipped
            const ccIds = ccRows.map((r) => r.id);
            if (ccIds.length) {
              await supabase.from("campaign_step_sends")
                .update({ status: "skipped", error_message: "Recipient bounced — skipped remaining sequence" })
                .in("campaign_contact_id", ccIds)
                .eq("status", "pending");

              // 4) Upsert a skipped row for any step that doesn't yet have a send row
              //    so the timeline shows "Bounced/Skipped" instead of "Pending".
              const campaignIds = Array.from(new Set(ccRows.map((r) => r.campaign_id)));
              const { data: steps } = await supabase
                .from("email_campaign_steps")
                .select("id, campaign_id, step_order")
                .in("campaign_id", campaignIds);
              const { data: existing } = await supabase
                .from("campaign_step_sends")
                .select("campaign_contact_id, step_id")
                .in("campaign_contact_id", ccIds);
              const existingKey = new Set((existing ?? []).map((s: any) => `${s.campaign_contact_id}::${s.step_id}`));
              const inserts: Array<Record<string, unknown>> = [];
              for (const cc of ccRows) {
                for (const s of steps ?? []) {
                  if (s.campaign_id !== cc.campaign_id) continue;
                  const key = `${cc.id}::${s.id}`;
                  if (existingKey.has(key)) continue;
                  inserts.push({
                    campaign_contact_id: cc.id,
                    step_id: s.id,
                    status: "skipped",
                    error_message: "Recipient bounced — skipped remaining sequence",
                  });
                }
              }
              if (inserts.length) {
                await supabase.from("campaign_step_sends").insert(inserts);
              }
            }

            console.log(`Cascaded bounce skip across ${ccRows.length} campaign_contact row(s) for ${recipientEmail}`);
          } catch (cascadeErr) {
            console.error("Bounce cascade error:", cascadeErr);
          }
        }
      } catch (crmErr) {
        console.error("CRM bounce handling error:", crmErr);
      }
    }

    return new Response(JSON.stringify({ ok: true, updated: targetLog.id, newStatus }), {
      status: 200,
      headers: { "Content-Type": "application/json", ...corsHeaders },
    });

  } catch (error) {
    console.error("Resend webhook error (acknowledging anyway to keep endpoint enabled):", error);
    return new Response(JSON.stringify({ ok: true, skipped: "internal_error", error: String(error) }), {
      status: 200,
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
  let matchedCampaignContactId: string | null = null;
  let matchedCampaignId: string | null = null;
  if (!isAutoReply && !internal && original) {
    const { data: stepSend } = await supabase
      .from("campaign_step_sends")
      .select("id, campaign_contact_id")
      .eq("email_log_id", original.id)
      .maybeSingle();

    if (stepSend) {
      await supabase.from("campaign_step_sends").update({ status: "replied" }).eq("id", stepSend.id);
      await supabase.from("campaign_contacts").update({ status: "replied" }).eq("id", stepSend.campaign_contact_id);
      campaignUpdated = true;
      matchedCampaignContactId = stepSend.campaign_contact_id;
    } else {
      const { data: cc } = await supabase
        .from("campaign_contacts").select("id").eq("email_log_id", original.id).maybeSingle();
      if (cc) {
        await supabase.from("campaign_contacts").update({ status: "replied" }).eq("id", cc.id);
        campaignUpdated = true;
        matchedCampaignContactId = cc.id;
      }
    }
    if (matchedCampaignContactId) {
      const { data: ccRow } = await supabase
        .from("campaign_contacts").select("campaign_id").eq("id", matchedCampaignContactId).maybeSingle();
      matchedCampaignId = ccRow?.campaign_id ?? null;
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

  // Owner alert email — genuine, non-internal replies only, dedup per campaign/thread
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
          fromEmail, fromName, subject, bodyText: plainBody,
          campaignName, contactId: activityContactId,
        });
      } else {
        console.log(`Skipping reply alert — duplicate reply from ${fromEmail}`);
      }
    } catch (alertErr) {
      console.error("Reply alert dispatch error:", alertErr);
    }
  }

  return {
    matched: !!original,
    auto_reply: isAutoReply,
    campaign_updated: campaignUpdated,
    email_log_id: emailLog.id,
  };
}

const APP_BASE_URL = "https://app.eventpix.com.au";
const RESEND_FROM_ALERTS = "EventPix Alerts <pix@rs.eventpix.com.au>";

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
    .from("email_logs").select("id", { count: "exact", head: true })
    .eq("direction", "inbound").eq("email_type", "inbound_reply")
    .ilike("from_email", fromEmail).neq("id", currentInboundId)
    .in("in_reply_to", relatedIds);
  return (count ?? 0) === 0;
}

async function sendReplyAlertEmail(
  supabase: any,
  params: {
    fromEmail: string; fromName: string | null; subject: string;
    bodyText: string | null; campaignName: string | null; contactId: string | null;
  },
): Promise<void> {
  const apiKey = Deno.env.get("RESEND_API_KEY");
  if (!apiKey) { console.warn("RESEND_API_KEY not set — skipping reply alert"); return; }
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
      body: JSON.stringify({
        from: RESEND_FROM_ALERTS, to: [ownerEmail],
        subject: alertSubject, html, reply_to: params.fromEmail,
      }),
    });
    if (!resp.ok) console.error("Reply alert send failed:", resp.status, await resp.text());
    else console.log(`Reply alert sent to ${ownerEmail} for ${params.fromEmail}`);
  } catch (e) {
    console.error("Reply alert error:", e);
  }
}

