/**
 * WEBSITE ENQUIRY INGEST
 *
 * Public webhook that accepts enquiry submissions from external sources
 * (WordPress / Elementor form webhook, Zapier, email parser, etc.) and
 * funnels them into the same lead-creation pipeline used by the in-app
 * public enquiry form.
 *
 * Accepts:
 *   - Content-Type: application/json — flat JSON or Elementor `fields` shape
 *   - Content-Type: application/x-www-form-urlencoded — flat form fields
 *   - Content-Type: multipart/form-data — flat form fields
 *
 * Field name resolution is case-insensitive and tolerant. It matches the
 * common labels used on eventpix.com.au forms:
 *   First Name, Last Name, Email, Phone, Company,
 *   Event Name / Event Type,
 *   Event Date, Event Location (ie. suburb or venue),
 *   What can we help you with? (message / enquiry),
 *   Where did you hear about us? (source),
 *   Budget
 *
 * No auth required — this endpoint is intentionally public.
 */

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function slugKey(k: string): string {
  return k.toLowerCase().replace(/[^a-z0-9]+/g, "");
}

/**
 * Flatten the various shapes external form services POST.
 * Handles:
 *   - Flat JSON: { name, email, ... }
 *   - Elementor Pro webhook: { form_fields: {...} } or { fields: {...} }
 *   - Elementor advanced: { fields: [{ id, title, value }, ...] }
 *   - URLSearchParams / FormData
 */
function normalisePayload(raw: any): Record<string, string> {
  const out: Record<string, string> = {};
  const put = (k: string, v: any) => {
    if (v === undefined || v === null) return;
    const s = typeof v === "string" ? v : String(v);
    if (!s.trim()) return;
    out[slugKey(k)] = s.trim();
  };

  const walk = (obj: any) => {
    if (!obj) return;
    if (Array.isArray(obj)) {
      // Elementor advanced fields: [{id, title, value}]
      for (const item of obj) {
        if (item && typeof item === "object" && ("value" in item)) {
          const key = item.id ?? item.title ?? item.name ?? item.label;
          if (key) put(String(key), item.value);
          if (item.title) put(String(item.title), item.value);
        }
      }
      return;
    }
    if (typeof obj !== "object") return;
    for (const [k, v] of Object.entries(obj)) {
      if (v && typeof v === "object") {
        // Elementor field object: { value: "..." }
        if ("value" in (v as any) && typeof (v as any).value !== "object") {
          put(k, (v as any).value);
        } else {
          walk(v);
        }
      } else {
        put(k, v);
      }
    }
  };

  walk(raw);
  return out;
}

function pick(fields: Record<string, string>, ...keys: string[]): string | undefined {
  for (const k of keys) {
    const v = fields[slugKey(k)];
    if (v) return v;
  }
  return undefined;
}

function firstMatch(fields: Record<string, string>, patterns: RegExp[]): string | undefined {
  for (const [k, v] of Object.entries(fields)) {
    for (const p of patterns) if (p.test(k)) return v;
  }
  return undefined;
}

function normaliseDate(input: string | undefined): string | undefined {
  if (!input) return undefined;
  const s = input.trim();
  // Already ISO
  if (/^\d{4}-\d{2}-\d{2}/.test(s)) return s.slice(0, 10);
  // dd/mm/yyyy or dd-mm-yyyy
  const m = s.match(/^(\d{1,2})[/\-.](\d{1,2})[/\-.](\d{2,4})$/);
  if (m) {
    const [, d, mo, y] = m;
    const yr = y.length === 2 ? `20${y}` : y;
    return `${yr}-${mo.padStart(2, "0")}-${d.padStart(2, "0")}`;
  }
  const parsed = new Date(s);
  if (!isNaN(parsed.getTime())) return parsed.toISOString().slice(0, 10);
  return undefined;
}

async function readBody(req: Request): Promise<any> {
  const ct = (req.headers.get("content-type") || "").toLowerCase();
  if (ct.includes("application/json")) {
    try { return await req.json(); } catch { return {}; }
  }
  if (ct.includes("application/x-www-form-urlencoded")) {
    const text = await req.text();
    const params = new URLSearchParams(text);
    const obj: Record<string, string> = {};
    for (const [k, v] of params.entries()) obj[k] = v;
    return obj;
  }
  if (ct.includes("multipart/form-data")) {
    const form = await req.formData();
    const obj: Record<string, string> = {};
    for (const [k, v] of form.entries()) if (typeof v === "string") obj[k] = v;
    return obj;
  }
  // Fallback: try JSON, then form
  const text = await req.text();
  try { return JSON.parse(text); } catch {
    const params = new URLSearchParams(text);
    const obj: Record<string, string> = {};
    for (const [k, v] of params.entries()) obj[k] = v;
    return obj;
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }
  if (req.method !== "POST") {
    return new Response(JSON.stringify({ success: false, error: "Method not allowed" }), {
      status: 405,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  try {
    const raw = await readBody(req);
    const fields = normalisePayload(raw);
    console.log("website-enquiry-ingest fields:", Object.keys(fields));

    const firstName =
      pick(fields, "first_name", "firstname", "fname", "given_name") ||
      firstMatch(fields, [/^first.*name$/i]);
    const lastName =
      pick(fields, "last_name", "lastname", "lname", "surname", "family_name") ||
      firstMatch(fields, [/^last.*name$/i]);
    const fullName =
      pick(fields, "name", "full_name", "fullname", "contact_name") ||
      [firstName, lastName].filter(Boolean).join(" ").trim();

    const email = pick(fields, "email", "email_address", "e_mail");
    const phone = pick(fields, "phone", "phone_number", "mobile", "tel", "telephone", "contact_phone");
    const company = pick(fields, "company", "organisation", "organization", "business", "company_name");

    const message =
      pick(fields, "message", "enquiry", "inquiry", "details", "comments", "notes") ||
      firstMatch(fields, [/help.*you.*with/i, /tell.*us.*about/i, /your.*message/i, /^enquiry$/i]);

    const eventDateRaw =
      pick(fields, "event_date", "eventdate", "date", "date_of_event") ||
      firstMatch(fields, [/event.*date/i]);
    const eventDate = normaliseDate(eventDateRaw);

    const location =
      pick(fields, "location", "event_location", "venue", "suburb", "city") ||
      firstMatch(fields, [/event.*location/i, /venue/i, /suburb/i]);

    const budget =
      pick(fields, "budget", "budget_range", "estimated_budget") ||
      firstMatch(fields, [/budget/i]);

    const leadSource =
      pick(fields, "lead_source", "source", "how_did_you_hear", "referral_source") ||
      firstMatch(fields, [/where.*hear/i, /hear.*about.*us/i, /how.*find.*us/i]);

    const eventType =
      pick(fields, "event_type", "event_type_name", "event_name", "type_of_event") ||
      firstMatch(fields, [/type.*of.*event/i, /event.*type/i, /event.*name/i]);

    if (!fullName || !email) {
      return new Response(
        JSON.stringify({
          success: false,
          error: "Missing required fields",
          detail: "name and email are required",
          received_keys: Object.keys(fields),
        }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // Compose a message if none supplied so the lead has something meaningful
    const composedMessage = (message && message.length >= 10)
      ? message
      : [
          `Website enquiry submitted.`,
          eventType ? `Event type: ${eventType}` : "",
          eventDate ? `Event date: ${eventDate}` : "",
          location ? `Location: ${location}` : "",
        ].filter(Boolean).join("\n");

    // Forward to the existing public-enquiry function so we share ONE
    // lead-creation code path.
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;

    const forwardPayload: Record<string, unknown> = {
      name: fullName,
      email,
      phone: phone || "",
      company: company || undefined,
      event_date: eventDate || undefined,
      location: location || undefined,
      budget: budget || undefined,
      lead_source: leadSource || undefined,
      message: composedMessage,
      // If a matching event type name exists we could resolve to id here, but
      // public-enquiry accepts free-text via message. We leave event_type_id
      // unset — CRM users can adjust on the lead.
      _external_event_type_hint: eventType || undefined,
    };

    const upstream = await fetch(`${supabaseUrl}/functions/v1/public-enquiry`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${anonKey}`,
        "apikey": anonKey,
        "x-original-forwarded-for":
          req.headers.get("x-forwarded-for") ?? req.headers.get("x-real-ip") ?? "",
      },
      body: JSON.stringify(forwardPayload),
    });

    const upstreamText = await upstream.text();
    let upstreamJson: any = null;
    try { upstreamJson = JSON.parse(upstreamText); } catch { /* ignore */ }

    if (!upstream.ok) {
      console.error("public-enquiry upstream failed:", upstream.status, upstreamText);
      return new Response(
        JSON.stringify({ success: false, error: "Downstream failure", status: upstream.status, details: upstreamText }),
        { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    return new Response(
      JSON.stringify({ success: true, ...(upstreamJson || {}) }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (e) {
    console.error("website-enquiry-ingest error:", e);
    return new Response(
      JSON.stringify({ success: false, error: "Unexpected error", details: String(e) }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
