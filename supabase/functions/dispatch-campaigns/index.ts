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

  async function invokeStep(campaignId: string, stepOrder: number) {
    try {
      const resp = await fetch(`${supabaseUrl}/functions/v1/send-campaign-step`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-cron-secret": cronSecret,
          "Authorization": `Bearer ${serviceKey}`,
        },
        body: JSON.stringify({ campaignId, stepOrder }),
      });
      const json = await resp.json().catch(() => ({}));
      results.push({ campaignId, stepOrder, ok: resp.ok, ...json });
    } catch (e) {
      results.push({ campaignId, stepOrder, ok: false, error: String(e) });
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
      .eq("is_sequence", true);

    for (const c of active || []) {
      const currentStep = c.current_step ?? 0;
      const nextStepOrder = currentStep + 1;

      const { data: nextStep } = await supabase
        .from("email_campaign_steps")
        .select("id, delay_days")
        .eq("campaign_id", c.id)
        .eq("step_order", nextStepOrder)
        .maybeSingle();
      if (!nextStep) continue;

      // Find the latest sent_at for the current (previous) step
      const { data: currentStepRow } = await supabase
        .from("email_campaign_steps")
        .select("id")
        .eq("campaign_id", c.id)
        .eq("step_order", currentStep)
        .maybeSingle();
      if (!currentStepRow) continue;

      const { data: lastSend } = await supabase
        .from("campaign_step_sends")
        .select("sent_at")
        .eq("step_id", currentStepRow.id)
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
