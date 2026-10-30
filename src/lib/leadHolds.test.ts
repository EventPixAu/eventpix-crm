// @vitest-environment node
import { PGlite } from '@electric-sql/pglite';
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { leadHoldEntries, type LeadHold } from '../../supabase/functions/_shared/leadHoldCalendar';

const hold: LeadHold = { assignment_id: 'a', lead_id: 'lead', session_id: 'tuesday', lead_name: 'Graduation', session_label: null, session_date: '2026-12-03', arrival_time: '16:00:00', start_time: '18:00:00', end_time: '23:00:00', timezone: 'Australia/Melbourne', venue_name: 'Lakeside' };

describe('On Hold invitation calendars', () => {
  it('uses arrival at 4pm through 11pm as tentative local time', () => {
    const entry = leadHoldEntries([hold])[0];
    expect(entry).toContain('DTSTART;TZID=Australia/Melbourne:20261203T160000');
    expect(entry).toContain('DTEND;TZID=Australia/Melbourne:20261203T230000');
    expect(entry).toContain('STATUS:TENTATIVE');
  });
  it('keeps resend and subscription UIDs stable and avoids duplicate sessions', () => {
    expect(leadHoldEntries([hold, { ...hold, assignment_id: 'another' }])).toHaveLength(1);
    expect(leadHoldEntries([hold])[0]).toContain('UID:lead-lead-tuesday@eventpix.com.au');
  });
  it('uses an exclusive next-day end for date-only holds', () => {
    const entry = leadHoldEntries([{ ...hold, arrival_time: null, start_time: null }])[0];
    expect(entry).toContain('DTSTART;VALUE=DATE:20261203');
    expect(entry).toContain('DTEND;VALUE=DATE:20261204');
  });
  it('restricts calendar holds to the assigned user and session without exposing lost or converted leads', async () => {
    const db = new PGlite();
    try {
      await db.exec(`CREATE ROLE anon; CREATE ROLE authenticated; CREATE ROLE service_role; CREATE SCHEMA auth;
        CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql AS $$ SELECT '00000000-0000-0000-0000-000000000001'::uuid $$;
        CREATE FUNCTION auth.role() RETURNS text LANGUAGE sql AS $$ SELECT 'authenticated' $$;
        CREATE FUNCTION has_role(uuid,text) RETURNS boolean LANGUAGE sql AS $$ SELECT false $$;
        CREATE TABLE leads(id uuid, lead_name text, estimated_event_date date, main_shoot_start_at timestamptz, main_shoot_end_at timestamptz, venue_text text, status text, converted_job_id uuid);
        CREATE TABLE lead_assignments(id uuid, lead_id uuid, user_id uuid, session_id uuid, confirmation_status text);
        CREATE TABLE event_sessions(id uuid, lead_id uuid, label text, session_date date, arrival_time time, start_time time, end_time time, timezone text, venue_name text, session_type text);
      `);
      await db.exec(readFileSync('drizzle/migrations/0050_lead_assignment_invitations_calendar.sql','utf8'));
      await db.exec(readFileSync('drizzle/migrations/0051_lead_hold_status_case.sql','utf8'));
      await db.exec(`INSERT INTO leads VALUES ('00000000-0000-0000-0000-000000000010','Graduation','2026-12-03',null,null,'Lakeside','budget_sent',null);
        INSERT INTO event_sessions VALUES ('00000000-0000-0000-0000-000000000020','00000000-0000-0000-0000-000000000010','Tuesday','2026-12-03','16:00','18:00','23:00','Australia/Melbourne','Lakeside','main'), ('00000000-0000-0000-0000-000000000021','00000000-0000-0000-0000-000000000010','Wednesday','2026-12-04','16:00','18:00','23:00','Australia/Melbourne','Lakeside','main');
        INSERT INTO lead_assignments VALUES ('00000000-0000-0000-0000-000000000030','00000000-0000-0000-0000-000000000010','00000000-0000-0000-0000-000000000001','00000000-0000-0000-0000-000000000020','on_hold');`);
      expect((await db.query('SELECT session_date::text,arrival_time::text FROM lead_calendar_holds()')).rows).toEqual([{ session_date: '2026-12-03', arrival_time: '16:00:00' }]);
      expect((await db.query("SELECT * FROM lead_calendar_holds('00000000-0000-0000-0000-000000000002')")).rows).toHaveLength(0);
      for (const status of ['lost','won','Won','Lost','on_hold_date_tba']) {
        await db.exec(`UPDATE leads SET status='${status}'`);
        expect((await db.query('SELECT * FROM lead_calendar_holds()')).rows).toHaveLength(0);
      }
      await db.exec("UPDATE leads SET status='budget_sent',converted_job_id='00000000-0000-0000-0000-000000000099'");
      expect((await db.query('SELECT * FROM lead_calendar_holds()')).rows).toHaveLength(0);
    } finally { await db.close(); }
  });
});