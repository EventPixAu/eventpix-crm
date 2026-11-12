import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { companyCertificates, teamCertificates } from '../_shared/clientCertificates.ts';

const headers = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'authorization, apikey, content-type, x-client-info, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version', 'Content-Type': 'application/json' };
serve(async req => {
  if (req.method === 'OPTIONS') return new Response(null, { headers });
  try {
    const url = Deno.env.get('SUPABASE_URL');
    const anon = Deno.env.get('SUPABASE_ANON_KEY');
    const key = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    if (!url || !anon || !key) throw new Error('Missing configuration');
    const authorization = req.headers.get('Authorization') || '';
    const client = createClient(url, anon, { global: { headers: { Authorization: authorization } } });
    const { data: { user }, error: authError } = await client.auth.getUser();
    if (authError || !user) return new Response(JSON.stringify({ error: 'Please sign in' }), { status: 401, headers });
    // Reuse the contact-scoped portal boundary; company membership grants no job access.
    const { data: portal, error } = await client.rpc('get_client_portal_data');
    if (error || !portal?.success) return new Response(JSON.stringify({ error: 'Portal unavailable' }), { status: 403, headers });
    const db = createClient(url, key);
    const company = await companyCertificates(db);
    const events = await Promise.all((portal.events || []).map(async (event: any) => ({ event_id: event.id, certificates: await teamCertificates(db, event.id) })));
    return new Response(JSON.stringify({ company, events }), { headers });
  } catch (error) {
    console.error('Client certificates failed', error);
    return new Response(JSON.stringify({ error: 'Unable to load certificates' }), { status: 500, headers });
  }
});