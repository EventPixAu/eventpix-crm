import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });

const VENUE_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  properties: {
    full_address: { type: ['string', 'null'] },
    website: { type: ['string', 'null'] },
    venue_type: {
      type: ['string', 'null'],
      enum: ['Hotel', 'Convention Centre', 'Function Centre', 'Stadium', 'Outdoor', 'Other', null],
    },
    suburb: { type: ['string', 'null'] },
    state: { type: ['string', 'null'] },
    postcode: { type: ['string', 'null'] },
    access_notes: { type: ['string', 'null'] },
    parking_access: { type: ['string', 'null'] },
    parking_cost: { type: ['string', 'null'] },
    events_dept_phone: { type: ['string', 'null'] },
    events_dept_email: { type: ['string', 'null'] },
  },
  required: [
    'full_address', 'website', 'venue_type', 'suburb', 'state', 'postcode',
    'access_notes', 'parking_access', 'parking_cost', 'events_dept_phone', 'events_dept_email',
  ],
};

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

  const authHeader = req.headers.get('Authorization');
  if (!authHeader?.startsWith('Bearer ')) return json({ error: 'Unauthorized' }, 401);

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_ANON_KEY')!,
    { global: { headers: { Authorization: authHeader } } },
  );
  const { data: claims, error: authErr } = await supabase.auth.getClaims(authHeader.replace('Bearer ', ''));
  if (authErr || !claims?.claims?.sub) return json({ error: 'Unauthorized' }, 401);

  try {
    const { name, address } = await req.json();
    if (!name || typeof name !== 'string' || name.trim().length < 2) {
      return json({ error: 'Venue name is required' }, 400);
    }
    const venueName = name.trim();

    // 1. Look for prior event records at this venue
    const escaped = venueName.replace(/[%_]/g, (m) => `\\${m}`);
    const { data: priorEvents } = await supabase
      .from('events')
      .select('venue_name, venue_address, venue_access_notes, venue_parking_notes, event_date')
      .ilike('venue_name', `%${escaped}%`)
      .order('event_date', { ascending: false })
      .limit(10);

    const fromEvents: Record<string, string> = {};
    for (const ev of priorEvents ?? []) {
      if (!fromEvents.full_address && ev.venue_address) fromEvents.full_address = ev.venue_address;
      if (!fromEvents.access_notes && ev.venue_access_notes) fromEvents.access_notes = ev.venue_access_notes;
      if (!fromEvents.parking_access && ev.venue_parking_notes) fromEvents.parking_access = ev.venue_parking_notes;
    }

    // 2. Ask the AI for publicly available details
    const lovableApiKey = Deno.env.get('LOVABLE_API_KEY');
    let aiFields: Record<string, string | null> = {};

    if (lovableApiKey) {
      const prompt = [
        `Provide publicly available operational details for this Australian event venue.`,
        `Venue name: ${venueName}`,
        address ? `Known address hint: ${address}` : '',
        priorEvents?.length ? `We have previously worked at this venue; recorded address: ${fromEvents.full_address ?? 'unknown'}.` : '',
        `Only include facts you are reasonably confident are correct and publicly published.`,
        `Use null for anything you do not know — never guess phone numbers, emails or URLs.`,
        `Keep each text field under 300 characters.`,
      ].filter(Boolean).join('\n');

      const res = await fetch('https://ai.gateway.lovable.dev/v1/responses', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Lovable-API-Key': lovableApiKey,
          'X-Lovable-AIG-SDK': 'fetch',
        },
        body: JSON.stringify({
          model: 'openai/gpt-5.6-sol',
          input: prompt,
          stream: true,
          text: {
            format: {
              type: 'json_schema',
              name: 'venue_details',
              strict: true,
              schema: VENUE_SCHEMA,
            },
          },
        }),
      });

      if (res.status === 429) return json({ error: 'AI rate limit reached, please try again shortly.' }, 429);
      if (res.status === 402) return json({ error: 'AI credits exhausted. Add credits to continue.' }, 402);
      if (!res.ok || !res.body) {
        const errText = await res.text();
        console.error('AI gateway error:', res.status, errText);
      } else {
        const reader = res.body.getReader();
        const decoder = new TextDecoder();
        let buffer = '';
        let text = '';
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split('\n');
          buffer = lines.pop() ?? '';
          for (const line of lines) {
            if (!line.startsWith('data:')) continue;
            const payload = line.slice(5).trim();
            if (!payload || payload === '[DONE]') continue;
            try {
              const evt = JSON.parse(payload);
              if (evt.type === 'response.output_text.delta' && typeof evt.delta === 'string') {
                text += evt.delta;
              }
            } catch { /* ignore partial */ }
          }
        }
        try {
          aiFields = JSON.parse(text);
        } catch {
          console.error('Could not parse AI output:', text.slice(0, 500));
        }
      }
    }

    // 3. Merge: prior event data wins over AI guesses
    const merged: Record<string, string> = {};
    const aiFilled: string[] = [];
    for (const [key, value] of Object.entries(aiFields)) {
      if (typeof value === 'string' && value.trim()) {
        merged[key] = value.trim();
        aiFilled.push(key);
      }
    }
    for (const [key, value] of Object.entries(fromEvents)) {
      merged[key] = value;
      if (!aiFilled.includes(key)) aiFilled.push(key);
    }

    return json({
      fields: merged,
      aiFilled,
      priorEventCount: priorEvents?.length ?? 0,
    });
  } catch (error) {
    console.error('venue-ai-lookup error:', error);
    return json({ error: 'Internal server error' }, 500);
  }
});
