// Exercise the actual portal SQL locally; company membership must not grant access.
// @vitest-environment node
import { readFileSync } from 'node:fs';
import { PGlite } from '@electric-sql/pglite';
import { beforeAll, afterAll, describe, expect, it } from 'vitest';

const db = new PGlite();
const rowena = '00000000-0000-0000-0000-000000000001';
const colleague = '00000000-0000-0000-0000-000000000002';
const company = '00000000-0000-0000-0000-000000000010';
const shared = '00000000-0000-0000-0000-000000000020';
const unrelated = '00000000-0000-0000-0000-000000000021';
const past = '00000000-0000-0000-0000-000000000022';

beforeAll(async () => {
  await db.exec(`
    CREATE ROLE anon; CREATE ROLE authenticated; CREATE ROLE service_role;
    CREATE SCHEMA auth;
    CREATE TABLE auth.users(id uuid, email text);
    CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql AS
      $$ SELECT current_setting('request.jwt.claim.sub', true)::uuid $$;
    CREATE TABLE clients(id uuid, business_name text, trading_name text);
    CREATE TABLE client_contacts(id uuid, client_id uuid, email text);
    CREATE TABLE contact_company_associations(contact_id uuid, company_id uuid, is_active boolean);
    CREATE TABLE event_contacts(event_id uuid, client_contact_id uuid, contact_email text);
    CREATE TABLE enquiry_contacts(lead_id uuid, contact_id uuid, contact_email text);
    CREATE TABLE events(id uuid, event_name text, event_date date, start_time text, end_time text,
      venue_name text, venue_address text, ops_status text, client_portal_token text,
      created_at timestamptz, client_id uuid, event_series_id uuid,
      share_meal_info boolean, meal_provided boolean, share_parking_info boolean,
      parking_provided boolean, meal_provision_status text, parking_provision_status text,
      share_team_dietary boolean);
    CREATE TABLE leads(id uuid, lead_name text, status text, estimated_event_date date,
      venue_text text, client_portal_token text, created_at timestamptz,
      updated_at timestamptz, client_id uuid, converted_job_id uuid);
    CREATE TABLE event_series(id uuid, name text);
    CREATE TABLE profiles(id uuid, full_name text, dietary_requirements text);
    CREATE TABLE staff_roles(id uuid, name text);
    CREATE TABLE event_assignments(event_id uuid, user_id uuid, staff_role_id uuid);
    CREATE TABLE event_agency_crew(event_id uuid, name text, role text, agency text, phone text, email text);
    INSERT INTO auth.users VALUES ('${rowena}', 'rowena.bale@a-w.com.au'), ('${colleague}', 'other@a-w.com.au');
    INSERT INTO clients VALUES ('${company}', 'A-W', NULL);
    INSERT INTO client_contacts VALUES ('${rowena}', '${company}', 'rowena.bale@a-w.com.au');
    INSERT INTO contact_company_associations VALUES ('${rowena}', '${company}', true);
    INSERT INTO events(id,event_name,event_date,ops_status,client_id) VALUES
      ('${shared}', 'Shared event', '2026-11-11', 'confirmed', '${company}'),
      ('${unrelated}', 'Other department', '2026-11-12', 'confirmed', '${company}'),
      ('${past}', 'Personally linked past event', '2026-06-11', 'completed', '${company}');
    INSERT INTO event_contacts VALUES
      ('${shared}', '${rowena}', '  '), ('${shared}', NULL, 'other@a-w.com.au'),
      ('${past}', NULL, ' ROWENA.BALE@A-W.COM.AU ');
    INSERT INTO leads(id,lead_name,status,client_id) VALUES
      ('${shared}', 'Linked proposal', 'new', '${company}'),
      ('${unrelated}', 'Other department proposal', 'new', '${company}');
    INSERT INTO enquiry_contacts VALUES ('${shared}', '${rowena}', NULL);
  `);
  await db.exec(readFileSync('drizzle/migrations/0026_client_portal_contact_only_access.sql', 'utf8'));
}, 30000);

afterAll(async () => { await db.close(); });

async function portal(user: string) {
  await db.query("SELECT set_config('request.jwt.claim.sub', $1, false)", [user]);
  const result = await db.query<{ data: { events: { id: string }[]; leads: { id: string }[] } }>(
    'SELECT public.get_client_portal_data() AS data',
  );
  return result.rows[0].data;
}

describe('Contact-level client portal access', () => {
  it('does not grant A-W company events through company membership', async () => {
    expect((await portal(rowena)).events.map(e => e.id).sort()).toEqual([shared, past].sort());
  });
  it('lets two event managers independently see the same shared event', async () => {
    expect((await portal(rowena)).events.map(e => e.id)).toContain(shared);
    expect((await portal(colleague)).events.map(e => e.id)).toEqual([shared]);
  });
  it('restricts company proposals to the personally listed contact', async () => {
    expect((await portal(rowena)).leads.map(l => l.id)).toEqual([shared]);
    expect((await portal(colleague)).leads).toEqual([]);
  });
  it('keeps past events only when personally linked', async () => {
    expect((await portal(rowena)).events.map(e => e.id)).toContain(past);
    expect((await portal(colleague)).events.map(e => e.id)).not.toContain(past);
  });
});