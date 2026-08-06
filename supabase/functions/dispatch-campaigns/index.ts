// Cron dispatcher: invokes send-campaign-step for:
//   1) Scheduled campaigns whose scheduled_at <= now()
//   2) In-progress sequence campaigns whose next step delay has elapsed
// Invoked every minute by pg_cron.
import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const cronSecret = Deno.env.get("CRON_SECRET") || "";
  const supabase = createClient(supabaseUrl, serviceKey);

  const results: Array<Record<string, unknown>> = [];

  async function invokeStep(campaignId: string, stepOrder: number, batchNumber?: number) {
    try {
      const resp = await fetch(`${supabaseUrl}/functions/v1/send-campaign-step`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-cron-secret": cronSecret,
          "Authorization": `Bearer ${serviceKey}`,
        },
        body: JSON.stringify({ campaignId, stepOrder, batchNumber }),
      });
      const json = await resp.json().catch(() => ({}));
      results.push({ campaignId, stepOrder, batchNumber, ok: resp.ok, ...json });
    } catch (e) {
      results.push({ campaignId, stepOrder, batchNumber, ok: false, error: String(e) });
    }
  }

  try {
    const nowIso = new Date().toISOString();

    // 1) Scheduled campaigns due now — atomically claim each one by
    // flipping status scheduled -> in_progress before invoking, so a
    // second overlapping cron run can never re-fire the same campaign.
    const { data: dueScheduled } = await supabase
      .from("email_campaigns")
      .select("id, scheduled_at, current_step")
      .eq("status", "scheduled")
      .eq("batch_count", 1)
      .lte("scheduled_at", nowIso);

    for (const c of dueScheduled || []) {
      const { data: claimed } = await supabase
        .from("email_campaigns")
        .update({ status: "in_progress" })
        .eq("id", c.id)
        .eq("status", "scheduled") // only succeeds if still scheduled
        .select("id")
        .maybeSingle();
      if (!claimed) {
        results.push({ campaignId: c.id, skipped: "already_claimed" });
        continue;
      }
      await invokeStep(c.id, c.current_step ?? 0);
    }


    // 2) Sequence follow-ups: in_progress, has next step, delay elapsed since last sent
    const { data: active } = await supabase
      .from("email_campaigns")
      .select("id, current_step")
      .eq("status", "in_progress")
      .eq("batch_count", 1)
      .eq("is_sequence", true);

    for (const c of active || []) {
      // After sending step N, send-campaign-step sets current_step = N + 1.
      // So `current_step` already points to the NEXT step to send, and the
      // previously sent step is `current_step - 1`.
      const nextStepOrder = c.current_step ?? 0;
      const prevStepOrder = nextStepOrder - 1;
      if (prevStepOrder < 0) continue; // step 0 is handled by the scheduled-campaign branch

      const { data: nextStep } = await supabase
        .from("email_campaign_steps")
        .select("id, delay_days")
        .eq("campaign_id", c.id)
        .eq("step_order", nextStepOrder)
        .maybeSingle();
      if (!nextStep) continue;

      // Find the latest sent_at for the previously sent step
      const { data: prevStepRow } = await supabase
        .from("email_campaign_steps")
        .select("id")
        .eq("campaign_id", c.id)
        .eq("step_order", prevStepOrder)
        .maybeSingle();
      if (!prevStepRow) continue;

      const { data: lastSend } = await supabase
        .from("campaign_step_sends")
        .select("sent_at")
        .eq("step_id", prevStepRow.id)
        .eq("status", "sent")
        .order("sent_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (!lastSend?.sent_at) continue;

      const delayMs = (nextStep.delay_days ?? 0) * 24 * 60 * 60 * 1000;
      const dueAt = new Date(new Date(lastSend.sent_at).getTime() + delayMs);
      if (dueAt.getTime() > Date.now()) continue;

      await invokeStep(c.id, nextStepOrder);
    }



    // 3) Batched campaigns — each batch has its own send time and advances its
    // own sequence from the date THAT batch was sent.
    const { data: batched } = await supabase
      .from("email_campaigns")
      .select("id, batch_count, batch_schedule, status")
      .gt("batch_count", 1)
      .in("status", ["scheduled", "in_progress"]);

    for (const c of batched || []) {
      const schedule: string[] = Array.isArray(c.batch_schedule) ? c.batch_schedule as string[] : [];

      const { data: steps } = await supabase
        .from("email_campaign_steps")
        .select("id, step_order, delay_days")
        .eq("campaign_id", c.id)
        .order("step_order");
      if (!steps || steps.length === 0) continue;

      const { data: batchContacts } = await supabase
        .from("campaign_contacts")
        .select("id, batch_number")
        .eq("campaign_id", c.id);
      const contactsByBatch = new Map<number, string[]>();
      for (const bc of batchContacts || []) {
        const b = (bc as { batch_number: number }).batch_number ?? 1;
        if (!contactsByBatch.has(b)) contactsByBatch.set(b, []);
        contactsByBatch.get(b)!.push((bc as { id: string }).id);
      }

      const stepIds = steps.map((s) => s.id);
      const { data: sends } = await supabase
        .from("campaign_step_sends")
        .select("step_id, campaign_contact_id, status, sent_at")
        .in("step_id", stepIds);

      let allBatchesDone = true;

      for (let b = 1; b <= (c.batch_count ?? 1); b++) {
        const idsInBatch = new Set(contactsByBatch.get(b) || []);
        if (idsInBatch.size === 0) continue;

        const batchSends = (sends || []).filter((s) =>
          idsInBatch.has((s as { campaign_contact_id: string }).campaign_contact_id)
        );

        // Highest step_order already processed for this batch + when it went out
        let highestSentOrder = -1;
        let lastSentAt: string | null = null;
        for (const st of steps) {
          const rows = batchSends.filter((s) => (s as { step_id: string }).step_id === st.id);
          if (rows.length === 0) continue;
          if (st.step_order > highestSentOrder) {
            highestSentOrder = st.step_order;
            lastSentAt = rows
              .map((r) => (r as { sent_at: string | null }).sent_at)
              .filter(Boolean)
              .sort()
              .pop() ?? null;
          }
        }

        const nextOrder = highestSentOrder + 1;
        const nextStep = steps.find((s) => s.step_order === nextOrder);
        if (!nextStep) continue; // this batch has finished its sequence

        allBatchesDone = false;

        if (nextOrder === 0) {
          const due = schedule[b - 1] ? new Date(schedule[b - 1]) : null;
          if (!due || due.getTime() > Date.now()) continue;
          await invokeStep(c.id, 0, b);
        } else {
          if (!lastSentAt) continue;
          const delayMs = (nextStep.delay_days ?? 0) * 24 * 60 * 60 * 1000;
          if (new Date(lastSentAt).getTime() + delayMs > Date.now()) continue;
          await invokeStep(c.id, nextOrder, b);
        }
      }

      if (allBatchesDone && c.status !== "completed") {
        await supabase.from("email_campaigns").update({ status: "completed" }).eq("id", c.id);
      }
    }

    return new Response(JSON.stringify({ success: true, dispatched: results.length, results }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    return new Response(JSON.stringify({ success: false, error: String(e), results }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
