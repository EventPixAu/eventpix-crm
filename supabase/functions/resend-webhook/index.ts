import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

/**
 * Resend Webhook Handler
 * 
 * Receives delivery status events from Resend and updates email_logs accordingly.
 * Configure in Resend dashboard: POST to https://<project>.supabase.co/functions/v1/resend-webhook
 * 
 * Events handled: email.delivered, email.bounced, email.complained,
 *                 email.opened, email.clicked, email.delivery_delayed
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
    const body = await req.json();
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
