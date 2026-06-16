/**
 * Generate Proposed Services (Scope of Services) description from quote line items
 * using Lovable AI Gateway. Returns clean HTML suitable for the contract / proposal.
 */
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      return new Response(JSON.stringify({ error: "Missing LOVABLE_API_KEY" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const body = await req.json().catch(() => ({}));
    const { quote_id, event_id, extra_context } = body as {
      quote_id?: string;
      event_id?: string;
      extra_context?: string;
    };

    if (!quote_id && !event_id) {
      return new Response(JSON.stringify({ error: "quote_id or event_id required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    // Gather context: items, event meta
    let itemsText = "";
    let eventMeta = "";

    if (quote_id) {
      const { data: items } = await supabase
        .from("quote_items")
        .select("description, quantity, unit_price, group_label, products(name, description)")
        .eq("quote_id", quote_id)
        .order("position", { ascending: true });

      itemsText = (items || [])
        .map((i: any) => {
          const name = i.description || i.products?.name || "Item";
          const grp = i.group_label ? `[${i.group_label}] ` : "";
          const qty = i.quantity ? ` × ${i.quantity}` : "";
          return `- ${grp}${name}${qty}`;
        })
        .join("\n");

      const { data: q } = await supabase
        .from("quotes")
        .select("event_id, lead_id, title")
        .eq("id", quote_id)
        .maybeSingle();
      if (q?.event_id && !event_id) {
        event_id = q.event_id;
      }
    }

    if (event_id) {
      const { data: ev } = await supabase
        .from("events")
        .select("event_name, event_date, venue_name, start_time, end_time, coverage_details, event_types(name)")
        .eq("id", event_id)
        .maybeSingle();
      if (ev) {
        eventMeta = [
          ev.event_name && `Event: ${ev.event_name}`,
          (ev as any).event_types?.name && `Type: ${(ev as any).event_types.name}`,
          ev.event_date && `Date: ${ev.event_date}`,
          ev.venue_name && `Venue: ${ev.venue_name}`,
          ev.start_time && `Time: ${ev.start_time}${ev.end_time ? ` – ${ev.end_time}` : ""}`,
          ev.coverage_details && `Coverage: ${ev.coverage_details}`,
        ].filter(Boolean).join("\n");
      }
    }

    const systemPrompt = `You are a professional event services proposal writer for Eventpix, an event photography & videography company.
Write a concise, client-facing "Scope of Services" description that summarises exactly what services will be provided for the event, based on the quoted line items.

Rules:
- Output clean HTML only — no markdown, no code fences, no <html>/<body> wrappers.
- Use <p>, <ul>, <li>, <strong> only. Keep it short and scannable.
- Group related services (e.g. Photography, Video, Edit/Delivery) under <strong> sub-headings where helpful.
- Describe deliverables and inclusions in plain professional language — do NOT list prices, quantities of hours unless materially descriptive, or internal SKU codes.
- Do NOT include greetings, sign-offs, dates, totals, terms, or payment information.
- Do NOT fabricate services that are not implied by the line items.
- Aim for 80–180 words.`;

    const userPrompt = `Event details:
${eventMeta || "(none provided)"}

Quoted line items:
${itemsText || "(none)"}

${extra_context ? `Additional context:\n${extra_context}` : ""}

Write the Scope of Services HTML now.`;

    const aiResp = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt },
        ],
      }),
    });

    if (aiResp.status === 429) {
      return new Response(JSON.stringify({ error: "Rate limit exceeded. Please try again shortly." }), {
        status: 429,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    if (aiResp.status === 402) {
      return new Response(JSON.stringify({ error: "AI credits exhausted. Add credits in Settings → Workspace → Usage." }), {
        status: 402,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    if (!aiResp.ok) {
      const errText = await aiResp.text();
      return new Response(JSON.stringify({ error: `AI gateway error: ${errText}` }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const aiData = await aiResp.json();
    let html: string = aiData?.choices?.[0]?.message?.content || "";
    // Strip any accidental code fences
    html = html.replace(/^```html\s*/i, "").replace(/^```\s*/i, "").replace(/```$/i, "").trim();

    return new Response(JSON.stringify({ html }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: (e as Error).message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
