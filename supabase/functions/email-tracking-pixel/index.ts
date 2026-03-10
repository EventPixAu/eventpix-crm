import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

// 1x1 transparent GIF
const PIXEL = new Uint8Array([
  0x47,0x49,0x46,0x38,0x39,0x61,0x01,0x00,0x01,0x00,
  0x80,0x00,0x00,0xff,0xff,0xff,0x00,0x00,0x00,0x21,
  0xf9,0x04,0x01,0x00,0x00,0x00,0x00,0x2c,0x00,0x00,
  0x00,0x00,0x01,0x00,0x01,0x00,0x00,0x02,0x02,0x44,
  0x01,0x00,0x3b,
]);

serve(async (req) => {
  try {
    const url = new URL(req.url);
    const emailLogId = url.searchParams.get("id");

    if (!emailLogId) {
      return new Response(PIXEL, {
        headers: { "Content-Type": "image/gif", "Cache-Control": "no-store, no-cache" },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, serviceRoleKey);

    // Update the email log: set status to opened, increment open_count
    const now = new Date().toISOString();
    await supabase
      .from("email_logs")
      .update({
        status: "opened",
        opened_at: now,
        open_count: supabase.rpc ? undefined : 1, // fallback
      })
      .eq("id", emailLogId)
      .in("status", ["sent", "delivered"]); // only upgrade, never downgrade (skip bounced/failed)

    // Increment open_count via raw SQL-safe approach
    const { data: current } = await supabase
      .from("email_logs")
      .select("open_count")
      .eq("id", emailLogId)
      .single();

    if (current) {
      await supabase
        .from("email_logs")
        .update({ open_count: (current.open_count || 0) + 1 })
        .eq("id", emailLogId);
    }

    return new Response(PIXEL, {
      headers: {
        "Content-Type": "image/gif",
        "Cache-Control": "no-store, no-cache, must-revalidate, proxy-revalidate",
        "Pragma": "no-cache",
        "Expires": "0",
      },
    });
  } catch (e) {
    console.error("Tracking pixel error:", e);
    return new Response(PIXEL, {
      headers: { "Content-Type": "image/gif", "Cache-Control": "no-store" },
    });
  }
});
