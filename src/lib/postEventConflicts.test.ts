// @vitest-environment node
import { PGlite } from '@electric-sql/pglite';
import { readFileSync } from 'node:fs';
import { expect, it } from 'vitest';

it('checks only the assigned Monday post-event session, not the Friday shoot', async () => {
  const db = new PGlite();
  try {
    await db.exec(`
      CREATE TABLE events(id uuid,event_name text,event_date date,start_at timestamptz,end_at timestamptz,start_time time,end_time time,timezone text,ops_status text);
      CREATE TABLE event_assignments(event_id uuid,user_id uuid,session_id uuid,call_time_at timestamptz,wrap_time_at timestamptz);
      CREATE TABLE event_sessions(id uuid,event_id uuid,session_date date,arrival_time time,start_time time,end_time time,timezone text,session_type text);
      INSERT INTO events VALUES('00000000-0000-0000-0000-000000000001','Churchill','2026-10-30',NULL,NULL,'18:30','21:00','Australia/Sydney','ready');
      INSERT INTO event_sessions VALUES
        ('00000000-0000-0000-0000-000000000002','00000000-0000-0000-0000-000000000001','2026-10-30','18:30','18:30','21:00','Australia/Sydney','live'),
        ('00000000-0000-0000-0000-000000000003','00000000-0000-0000-0000-000000000001','2026-11-02','09:00','09:00','17:00','Australia/Sydney','post_production');
      INSERT INTO event_assignments VALUES('00000000-0000-0000-0000-000000000001','00000000-0000-0000-0000-000000000004','00000000-0000-0000-0000-000000000003',NULL,NULL);
    `);
    await db.exec(readFileSync('drizzle/migrations/0035_assignment_scoped_session_conflicts.sql', 'utf8'));
    const check = (date: string) => db.query(`SELECT * FROM check_staff_conflicts('00000000-0000-0000-0000-000000000004','${date} 00:00 Australia/Sydney','${date} 23:59 Australia/Sydney')`);
    expect((await check('2026-10-30')).rows).toHaveLength(0);
    expect((await check('2026-11-02')).rows).toHaveLength(1);
    await db.exec(`UPDATE events SET ops_status='cancelled'`);
    expect((await check('2026-11-02')).rows).toHaveLength(0);
  } finally { await db.close(); }
});