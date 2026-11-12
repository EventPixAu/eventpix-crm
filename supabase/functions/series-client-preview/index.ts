import { createClient } from 'npm:@supabase/supabase-js@2';
import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors';
import { z } from 'npm:zod@3';
import { companyCertificates, teamCertificates, clientCertificateAssignment } from '../_shared/clientCertificates.ts';
import { contactEventIds } from '../_shared/seriesClientScope.ts';

const headers = { ...corsHeaders, 'Content-Type': 'application/json' };
const schema = z.object({ seriesId: z.string().uuid(), contactId: z.string().uuid() });
Deno.serve(async req => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers });
  try {
    const url = Deno.env.get('SUPABASE_URL');
    const anon = Deno.env.get('SUPABASE_ANON_KEY');
    const key = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    if (!url || !anon || !key) throw new Error('Missing configuration');
    const client = createClient(url, anon, { global: { headers: { Authorization: req.headers.get('Authorization') || '' } } });
    const { data: { user }, error: authError } = await client.auth.getUser();
    if (authError || !user) return new Response(JSON.stringify({ error: 'Please sign in' }), { status: 401, headers });
    const { data: admin, error: roleError } = await client.rpc('is_admin');
    if (roleError || !admin) return new Response(JSON.stringify({ error: 'Admin access required' }), { status: 403, headers });
    const parsed = schema.safeParse(await req.json());
    if (!parsed.success) return new Response(JSON.stringify({ error: 'Select a series and client contact' }), { status: 400, headers });
    const { seriesId, contactId } = parsed.data;
    const db = createClient(url, key);
    const { data: contact, error: contactError } = await db.from('client_contacts').select('email').eq('id', contactId).maybeSingle();
    if (contactError) throw contactError;
    if (!contact?.email) return new Response(JSON.stringify({ error: 'The selected contact needs an email address' }), { status: 400, headers });
    const { data: series, error: seriesError } = await db.from('event_series').select('name').eq('id', seriesId).maybeSingle();
    if (seriesError || !series) return new Response(JSON.stringify({ error: 'Series not found' }), { status: 404, headers });
    const { data: rows, error } = await db.from('events').select('id,event_name,event_date,start_time,end_time,venue_name,ops_status,client_portal_token,created_at,share_team_dietary,share_meal_info,share_parking_info,meal_provided,parking_provided,meal_provision_status,parking_provision_status').eq('event_series_id', seriesId).order('event_date');
    if (error) throw error;
    const linkedIds = new Set<string>();
    for (let offset = 0; offset < (rows || []).length; offset += 100) {
      const ids = (rows || []).slice(offset, offset + 100).map(e => e.id);
      const { data: links, error: linkError } = await db.from('event_contacts').select('event_id,contact_email,client_contact:client_contacts!event_contacts_client_contact_id_fkey(email)').in('event_id', ids);
      if (linkError) throw linkError;
      for (const id of contactEventIds((links || []) as any, contact.email)) linkedIds.add(id);
    }
    const events = await Promise.all((rows || []).filter(e => linkedIds.has(e.id) && e.ops_status !== 'cancelled').map(async e => {
      const { data: assignments, error: assignmentError } = await db.from('event_assignments').select('assignment_status,role_on_event,staff_role:staff_roles(name),profile:profiles!event_assignments_user_id_fkey(full_name,dietary_requirements),staff:staff_id(name,role)').eq('event_id', e.id);
      if (assignmentError) throw assignmentError;
      const { data: agency, error: agencyError } = await db.from('event_agency_crew').select('name,role,agency,phone,email').eq('event_id', e.id);
      if (agencyError) throw agencyError;
      return { id: e.id, event_name: e.event_name, event_date: e.event_date, start_time: e.start_time, end_time: e.end_time, venue_name: e.venue_name, ops_status: e.ops_status, client_portal_token: e.client_portal_token, created_at: e.created_at, series_id: seriesId, series_name: series.name,
        meal_provided: e.share_meal_info ? e.meal_provided : null, meal_provision_status: e.share_meal_info ? e.meal_provision_status : null,
        parking_provided: e.share_parking_info ? e.parking_provided : null, parking_provision_status: e.share_parking_info ? e.parking_provision_status : null,
        crew: [...(assignments || []).filter(clientCertificateAssignment).map((a: any) => ({ name: a.profile?.full_name || a.staff?.name, role: a.staff_role?.name || a.role_on_event || a.staff?.role, dietary_requirements: e.share_team_dietary ? a.profile?.dietary_requirements : null })), ...(agency || []).filter(a => clientCertificateAssignment({ role_on_event: a.role })).map(a => ({ ...a, is_agency: true }))] };
    }));
    const certificates = { company: await companyCertificates(db), events: await Promise.all(events.map(async e => ({ event_id: e.id, certificates: await teamCertificates(db, e.id) }))) };
    return new Response(JSON.stringify({ success: true, events, leads: [], companies: [], email: contact.email, series_name: series.name, certificates }), { headers });
  } catch (error) {
    console.error('Series client preview failed', error);
    return new Response(JSON.stringify({ error: 'Unable to load the client view' }), { status: 500, headers });
  }
});