import { createClient } from 'npm:@supabase/supabase-js@2';
import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors';
import { z } from 'npm:zod@3';
import { normalizeMobile, acceptedMessage, renderTemplate, deliveryBodyTemplate, DEFAULT_SETUP_TEMPLATE, JOB_SHEET_LINK, FOLLOWUP_RESEND_WINDOW_MS } from './reminders.ts';

const Body = z.object({ ticket: z.string().uuid().optional(), mode: z.enum(['process', 'verify', 'preview', 'followup']).default('process'), event_id: z.string().uuid().optional() }).strict();
const reply = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

type Db = ReturnType<typeof createClient>;
async function deliver(db: Db, headers: Record<string, string>, logId: string, phone: string, body: string): Promise<'sent' | 'failed'> {
  try {
    const response = await fetch('https://rest.clicksend.com/v3/sms/send', { method: 'POST', headers, body: JSON.stringify({ messages: [{ source: 'Eventpixii', from: 'EventPix', to: phone, body, custom_string: logId }] }), signal: AbortSignal.timeout(15000) });
    const result = await response.json();
    const messageId = response.ok ? acceptedMessage(result) : null;
    const { error: updateError } = await db.from('crew_sms_logs').update({ status: messageId ? 'sent' : 'failed', provider_message_id: messageId, sent_at: messageId ? new Date().toISOString() : null, error_code: messageId ? null : `HTTP_${response.status}_${String(result.response_code || 'REJECTED').replace(/[^A-Z_]/g, '')}` }).eq('id', logId);
    if (updateError) throw new Error('Delivery result could not be recorded');
    return messageId ? 'sent' : 'failed';
  } catch {
    // Ambiguous network failures must not be automatically resent, to avoid duplicate paid SMS.
    await db.from('crew_sms_logs').update({ status: 'unknown', error_code: 'DELIVERY_UNCONFIRMED' }).eq('id', logId);
    return 'failed';
  }
}

Deno.serve(async req => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (req.method !== 'POST') return reply({ error: 'Method not allowed' }, 405);
  try {
    const parsed = Body.safeParse(await req.json());
    if (!parsed.success) return reply({ error: 'Invalid request' }, 400);
    const url = Deno.env.get('SUPABASE_URL');
    const key = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    const anon = Deno.env.get('SUPABASE_ANON_KEY');
    if (!url || !key || !anon) return reply({ error: 'Service unavailable' }, 503);
    const db = createClient(url, key);
    let authorized = false;
    if (parsed.data.ticket && parsed.data.mode === 'process') {
      const { data, error } = await db.rpc('consume_crew_sms_ticket', { _token: parsed.data.ticket });
      authorized = !error && data === true;
    } else {
      const authorization = req.headers.get('Authorization') || '';
      const auth = createClient(url, anon, { global: { headers: { Authorization: authorization } } });
      const { data } = await auth.auth.getClaims(authorization.replace(/^Bearer /, ''));
      const id = data?.claims?.sub;
      if (id) {
        const { data: roles, error } = await db.from('user_roles').select('role').eq('user_id', id).eq('role', 'admin');
        authorized = !error && Boolean(roles?.length);
      }
    }
    if (!authorized) return reply({ error: 'Unauthorized' }, 401);
    const username = Deno.env.get('CLICKSEND_USERNAME');
    const apiKey = Deno.env.get('CLICKSEND_API_KEY');
    if (!username || !apiKey) return reply({ error: 'ClickSend is not configured' }, 503);
    const headers = { Authorization: `Basic ${btoa(`${username}:${apiKey}`)}`, 'Content-Type': 'application/json' };
    if (parsed.data.mode === 'verify') {
      const response = await fetch('https://rest.clicksend.com/v3/account', { headers });
      const result = await response.json();
      // Do not return account details or any credential-derived information.
      return reply({ configured: response.ok && result.response_code === 'SUCCESS', provider_status: response.status }, response.ok ? 200 : 502);
    }
    const { data: templates, error: templatesError } = await db.from('crew_sms_settings').select('setup_template, delivery_template, delivery_template_masv').eq('id', true).maybeSingle();
    if (templatesError) throw new Error('Cannot load SMS templates');
    const { data: candidates, error } = await db.rpc('crew_sms_candidates');
    if (error) throw new Error('Cannot load SMS reminders');
    if (parsed.data.mode === 'preview') return reply({ due: candidates?.length || 0 });
    const masvEventIds = [...new Set((candidates || []).map((c) => c.event_id))];
    const { data: masvRows } = masvEventIds.length
      ? await db.from('events').select('id').in('id', masvEventIds).eq('crew_sms_masv_delivery', true)
      : { data: [] as { id: string }[] };
    const masvEvents = new Set((masvRows || []).map((r) => r.id));
    let sent = 0, failed = 0, skipped = 0;
    for (const c of candidates || []) {
      const phone = normalizeMobile(c.phone);
      if (!phone) { skipped++; continue; }
      const timeFormat = new Intl.DateTimeFormat('en-AU', { timeZone: c.timezone, weekday: 'short', day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit', timeZoneName: 'short' });
      const body = c.reminder_type === 'setup'
        ? renderTemplate(templates?.setup_template || DEFAULT_SETUP_TEMPLATE, { event_name: c.event_name, venue: c.venue_name || 'TBC', setup_time: timeFormat.format(new Date(c.setup_at)), job_sheet_link: JOB_SHEET_LINK })
        : renderTemplate(deliveryBodyTemplate(masvEvents.has(c.event_id), templates), { event_name: c.event_name, finish_time: timeFormat.format(new Date(c.finish_at)), job_sheet_link: JOB_SHEET_LINK });
      if (/\{\{[^}]*\}\}/.test(body)) { skipped++; continue; }
      const { data: log, error: claimError } = await db.from('crew_sms_logs').insert({ event_id: c.event_id, session_key: c.session_key, recipient_key: c.recipient_key, reminder_type: c.reminder_type, due_at: c.due_at, phone, body }).select('id').maybeSingle();
      if (claimError || !log) { if (claimError?.code !== '23505') failed++; else skipped++; continue; }
      // Recheck after claiming: cancellation, reassignment or timing edits invalidate the candidate.
      const { data: fresh, error: recheckError } = await db.rpc('crew_sms_candidates');
      const stillDue = !recheckError && fresh?.some((r: typeof c) => r.event_id === c.event_id && r.session_key === c.session_key && r.recipient_key === c.recipient_key && r.reminder_type === c.reminder_type && r.due_at === c.due_at && normalizeMobile(r.phone) === phone);
      if (!stillDue) {
        const { error: removeError } = await db.from('crew_sms_logs').delete().eq('id', log.id);
        if (removeError) failed++; else skipped++;
        continue;
      }
      try {
        const response = await fetch('https://rest.clicksend.com/v3/sms/send', { method: 'POST', headers, body: JSON.stringify({ messages: [{ source: 'Eventpixii', from: 'EventPix', to: phone, body, custom_string: log.id }] }), signal: AbortSignal.timeout(15000) });
        const result = await response.json();
        const messageId = response.ok ? acceptedMessage(result) : null;
        const { error: updateError } = await db.from('crew_sms_logs').update({ status: messageId ? 'sent' : 'failed', provider_message_id: messageId, sent_at: messageId ? new Date().toISOString() : null, error_code: messageId ? null : `HTTP_${response.status}_${String(result.response_code || 'REJECTED').replace(/[^A-Z_]/g, '')}` }).eq('id', log.id);
        if (updateError) throw new Error('Delivery result could not be recorded');
        if (messageId) sent++; else failed++;
      } catch {
        // Ambiguous network failures must not be automatically resent, to avoid duplicate paid SMS.
        await db.from('crew_sms_logs').update({ status: 'unknown', error_code: 'DELIVERY_UNCONFIRMED' }).eq('id', log.id);
        failed++;
      }
    }
    return reply({ sent, failed, skipped });
  } catch {
    return reply({ error: 'Crew SMS processing failed' }, 500);
  }
});