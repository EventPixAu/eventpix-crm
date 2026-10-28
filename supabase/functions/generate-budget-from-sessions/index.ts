/**
 * Generate Budget From Event Sessions
 *
 * Builds draft budget (quote) line items from the linked event/enquiry
 * sessions using the Lovable AI Gateway (OpenAI Responses, structured
 * output). Prices are ex GST; GST (10%) is applied on top via tax_rate.
 *
 * Auth: requires a signed-in user; all database access runs with the
 * caller's JWT so existing RLS (Admin/Sales) decides access.
 */
import { createClient } from "npm:@supabase/supabase-js@2";
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";
import { createOpenAI } from "npm:@ai-sdk/openai";
import { streamText, Output } from "npm:ai";
import { z } from "npm:zod@3";
import { photographyPrice, coverageDays, catalogueItem } from "./pricing.ts";
import {
  createLovableAiGatewayRunIdFetch,
  getLovableAiGatewayRunId,
} from "./run-id.ts";

const GATEWAY_URL = "https://ai.gateway.lovable.dev/v1";
const MODEL = "openai/gpt-6-astra";
const GROUP_LABELS = [
  "Photography",
  "Video",
  "Editing",
  "Delivery",
  "Equipment",
  "Travel & Parking",
  "Other",
] as const;

const ItemSchema = z.object({
  description: z.string(),
  quantity: z.number(),
  unit_price: z.number(),
  group_label: z.string(),
  product_id: z.string().nullable(),
  session_dates: z.array(z.string()),
});
const BudgetSchema = z.object({ items: z.array(ItemSchema) });

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      return jsonResponse({ error: "AI is not configured (missing key)." }, 500);
    }

    const authHeader = req.headers.get("Authorization") || "";
    if (!authHeader.startsWith("Bearer ")) {
      return jsonResponse({ error: "Sign in required." }, 401);
    }

    const body = await req.json().catch(() => ({}));
    const quoteId = typeof body.quote_id === "string" ? body.quote_id : "";
    if (!/^[0-9a-fA-F-]{36}$/.test(quoteId)) {
      return jsonResponse({ error: "quote_id is required." }, 400);
    }

    // All DB access uses the caller's JWT so RLS enforces Admin/Sales access.
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } },
    );
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return jsonResponse({ error: "Sign in required." }, 401);
    }

    const { data: quote, error: quoteError } = await supabase
      .from("quotes")
      .select("id, status, event_id, linked_event_id, lead_id, client_id, quote_name")
      .eq("id", quoteId)
      .maybeSingle();
    if (quoteError) return jsonResponse({ error: quoteError.message }, 500);
    if (!quote) return jsonResponse({ error: "Budget not found." }, 404);
    if (quote.status && quote.status !== "draft") {
      return jsonResponse({ error: "Only draft budgets can be built from sessions." }, 400);
    }

    // Resolve the linked event (either side of the relationship) and lead.
    let event: any = null;
    const directEventId = quote.event_id || quote.linked_event_id;
    if (directEventId) {
      const { data } = await supabase
        .from("events")
        .select("id, event_name, event_date, venue_name, coverage_details, lead_id, event_types!events_event_type_id_fkey(name)")
        .eq("id", directEventId)
        .maybeSingle();
      event = data;
    }
    if (!event) {
      const { data } = await supabase
        .from("events")
        .select("id, event_name, event_date, venue_name, coverage_details, lead_id, event_types!events_event_type_id_fkey(name)")
        .eq("quote_id", quoteId)
        .order("event_date", { ascending: true })
        .limit(1)
        .maybeSingle();
      event = data;
    }
    const leadId = quote.lead_id || event?.lead_id || null;

    const { data: lead } = leadId
      ? await supabase
          .from("leads")
          .select("id, lead_name, estimated_event_date, venue_text, requirements_summary, event_types!leads_event_type_id_fkey(name)")
          .eq("id", leadId)
          .maybeSingle()
      : { data: null as any };

    // Sessions for the event, falling back to the enquiry's sessions.
    let sessions: any[] = [];
    if (event?.id) {
      const { data } = await supabase
        .from("event_sessions")
        .select("session_date, start_time, end_time, arrival_time, label, venue_name, session_type, notes")
        .eq("event_id", event.id)
        .order("session_date", { ascending: true });
      sessions = data || [];
    }
    if (!sessions.length && leadId) {
      const { data } = await supabase
        .from("event_sessions")
        .select("session_date, start_time, end_time, arrival_time, label, venue_name, session_type, notes")
        .eq("lead_id", leadId)
        .order("session_date", { ascending: true });
      sessions = data || [];
    }
    if (!sessions.length) {
      return jsonResponse({
        error: "No event sessions found. Add sessions to the event or enquiry first.",
      }, 400);
    }

    // Active product catalogue so the AI can reuse existing products/prices.
    const { data: products, error: productError } = await supabase
      .from("products")
      .select("id, name, description, unit_price, tax_rate, is_package")
      .eq("is_active", true)
      .order("name", { ascending: true });
    if (productError) return jsonResponse({ error: productError.message }, 500);
    if (!products?.length) return jsonResponse({ error: "Add active rates in Products first. No estimated rates will be used." }, 400);
    const days = coverageDays(sessions);

    const sessionLines = sessions.map((s: any) => {
      const hours = s.start_time && s.end_time
        ? ` (${s.start_time} – ${s.end_time}${s.arrival_time ? `, arrive ${s.arrival_time}` : ""})`
        : "";
      return `- ${s.session_date}${hours}: ${s.label || s.session_type || "Session"}${s.venue_name ? ` at ${s.venue_name}` : ""}${s.notes ? ` — notes: ${s.notes}` : ""}`;
    }).join("\n");

    const contextLines = [
      event?.event_name && `Event: ${event.event_name}`,
      (event as any)?.event_types?.name && `Type: ${(event as any).event_types.name}`,
      !event && lead?.lead_name && `Enquiry: ${lead.lead_name}`,
      !event && (lead as any)?.event_types?.name && `Type: ${(lead as any).event_types.name}`,
      !event && lead?.requirements_summary && `Requirements: ${lead.requirements_summary}`,
      (event?.venue_name || lead?.venue_text) && `Venue: ${event?.venue_name || lead?.venue_text}`,
      event?.coverage_details && `Coverage details: ${event.coverage_details}`,
    ].filter(Boolean).join("\n");

    const catalogLines = (products || []).map((p: any) =>
      `- id:${p.id} | ${p.name}${p.description ? ` — ${p.description}` : ""} | $${p.unit_price} ex GST${p.is_package ? " | package" : ""}`
    ).join("\n");

    const instructions = `You are a quoting assistant for Eventpix, an Australian event photography & videography company.
Given the event/enquiry details, its sessions, and the existing product catalogue, propose the budget line items.

Rules:
- For photography, produce one coverage item per session day, combining all live sessions on that date and excluding post_production sessions. Set session_dates to that single yyyy-MM-dd date. Use EPX1 and quantity = max(total coverage hours that day, 2) + 1. Ignore arrival times. First two hours cost three hourly units; each additional hour costs one. The server calculates photography prices from the sessions and Products, not your estimates.
- Every item MUST use an active catalogue product_id and its unit_price. Never estimate market rates or create unmatched items. For non-coverage items set session_dates to [].
- ALL prices are in AUD and EX GST. Never include GST in unit_price. Tax is added on top by the system.
- Set group_label to exactly one of: ${GROUP_LABELS.join(", ")}.
- Do not add separate editing or delivery merely because there is photography: catalogue coverage includes these. Only include additional services when explicitly requested and matched to a catalogue product.
- Do not invent travel, equipment or add-on items unless the details mention them.
- Keep descriptions short and client-facing (no internal codes).`;

    const runIdFetch = createLovableAiGatewayRunIdFetch(getLovableAiGatewayRunId(req));
    const provider = createOpenAI({
      baseURL: GATEWAY_URL,
      apiKey: LOVABLE_API_KEY,
      headers: { "Lovable-API-Key": LOVABLE_API_KEY, "X-Lovable-AIG-SDK": "vercel-ai-sdk" },
      fetch: runIdFetch.fetch,
    });

    const result = streamText({
      model: provider.responses(MODEL),
      instructions,
      messages: [{
        role: "user",
        content: `Event details:\n${contextLines || "(none)"}\n\nSessions:\n${sessionLines}\n\nProduct catalogue:\n${catalogLines || "(empty)"}\n\nPropose the budget items now.`,
      }],
      output: Output.object({ schema: BudgetSchema }),
      abortSignal: req.signal,
      providerOptions: {
        openai: {
          store: false,
          forceReasoning: true,
          reasoningEffort: "low",
          reasoningSummary: "auto",
          include: ["reasoning.encrypted_content"],
        },
      },
    });

    let streamError: unknown = null;
    for await (const part of result.fullStream) {
      if (part.type === "error") streamError = (part as { error: unknown }).error;
    }
    if (streamError) {
      return jsonResponse({ error: `AI error: ${String(streamError)}` }, 502);
    }
    const proposed = await result.output;

    // Validate against the catalogue and the fixed group labels; tax is
    // enforced server-side (10% GST, ex-GST prices) and never from the AI.
    const { data: existingItems } = await supabase
      .from("quote_items")
      .select("sort_order")
      .eq("quote_id", quoteId)
      .order("sort_order", { ascending: false })
      .limit(1);
    let sortOrder = (existingItems?.[0]?.sort_order ?? -1) + 1;

    const items = proposed?.items || [];
    const photographyItems = items.filter(i => i.group_label === 'Photography' && i.session_dates.length > 0);
    const pricedItems = photographyItems.length ? [
      ...days.map(day => ({
        description: photographyItems.find(i => i.session_dates.includes(day.date))?.description || `${day.date} — ${day.labels.join(', ') || 'Photography coverage'}`,
        group_label: 'Photography',
        ...photographyPrice(day.hours, products),
      })),
      ...items.filter(i => !photographyItems.includes(i)).map(i => ({ ...i, ...catalogueItem(i, products) })),
    ] : items.map(i => ({ ...i, ...catalogueItem(i, products) }));
    const rows = pricedItems
      .filter(i => i.description?.trim())
      .map((i) => {
        return {
          quote_id: quoteId,
          product_id: i.product_id,
          description: i.description.trim(),
          quantity: Number.isFinite(i.quantity) && i.quantity > 0 ? i.quantity : 1,
          unit_price: Math.round(i.unit_price * 100) / 100,
          tax_rate: 0.1,
          group_label: (GROUP_LABELS as readonly string[]).includes(i.group_label)
            ? i.group_label
            : "Photography",
          sort_order: sortOrder++,
        };
      });

    if (!rows.length) {
      return jsonResponse({ error: "The AI could not propose any items from these sessions." }, 502);
    }

    const { data: inserted, error: insertError } = await supabase
      .from("quote_items")
      .insert(rows)
      .select("id, description, quantity, unit_price, group_label");
    if (insertError) return jsonResponse({ error: insertError.message }, 500);

    return jsonResponse({ items: inserted });
  } catch (e) {
    const status = (e as { name?: string })?.name === "AbortError" ? 499 : 500;
    return jsonResponse({ error: (e as Error).message }, status);
  }
});
