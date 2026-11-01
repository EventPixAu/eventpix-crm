// @vitest-environment node
import { PGlite } from '@electric-sql/pglite';
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { assignmentRateSnapshot } from './assignmentRateSnapshot';

const series = '00000000-0000-0000-0000-000000000001';
const event = '00000000-0000-0000-0000-000000000002';
const role = '00000000-0000-0000-0000-000000000003';

async function setup() {
  const db = new PGlite();
  await db.exec(`
    CREATE TABLE pay_rate_card(id uuid DEFAULT gen_random_uuid(),staff_role_id uuid,rate_mode text,hourly_rate numeric,minimum_paid_hours numeric,fixed_rate numeric,created_at timestamptz,updated_at timestamptz);
    CREATE TABLE series_fixed_rates(series_id uuid,staff_role_id uuid,fixed_rate numeric);
    CREATE TABLE events(id uuid,event_series_id uuid);
    CREATE TABLE event_assignments(id uuid DEFAULT gen_random_uuid(),event_id uuid,staff_role_id uuid,pay_rate_snapshot jsonb);
    CREATE TABLE quote_items(unit_price numeric);
    INSERT INTO pay_rate_card(staff_role_id,rate_mode,hourly_rate) VALUES ('${role}','hourly',40);
    INSERT INTO events VALUES('${event}','${series}');
    INSERT INTO quote_items VALUES(275);
  `);
  await db.exec(readFileSync('drizzle/migrations/0052_series_assignment_rate_snapshots.sql', 'utf8'));
  await db.exec(`CREATE TRIGGER snapshot_assignment_pay_rate BEFORE INSERT OR UPDATE ON event_assignments FOR EACH ROW EXECUTE FUNCTION snapshot_assignment_pay_rate();`);
  return db;
}

describe('series team fixed rates', () => {
  it('uses a fixed LBA Assistant amount rather than hourly pay', async () => {
    const db = await setup();
    try {
      await db.exec(`INSERT INTO series_fixed_rates VALUES('${series}','${role}',220); INSERT INTO event_assignments(event_id,staff_role_id) VALUES('${event}','${role}');`);
      const { rows } = await db.query<{ pay_rate_snapshot: { rate_mode: string; fixed_rate: number; hourly_rate: null; minimum_paid_hours: null } }>('SELECT pay_rate_snapshot FROM event_assignments');
      expect(assignmentRateSnapshot(rows[0], undefined)).toEqual({rate_mode:'fixed',fixed_rate:220,hourly_rate:null,minimum_paid_hours:null});
    } finally { await db.close(); }
  });
  it('keeps existing pay frozen when the series rate changes', async () => {
    const db = await setup();
    try {
      await db.exec(`INSERT INTO series_fixed_rates VALUES('${series}','${role}',220); INSERT INTO event_assignments(event_id,staff_role_id) VALUES('${event}','${role}'); UPDATE series_fixed_rates SET fixed_rate=250; INSERT INTO event_assignments(event_id,staff_role_id) VALUES('${event}','${role}');`);
      expect((await db.query("SELECT pay_rate_snapshot->>'fixed_rate' AS rate FROM event_assignments")).rows).toEqual([{rate:'220'},{rate:'250'}]);
    } finally { await db.close(); }
  });
  it('does not change client budget prices', async () => {
    const db = await setup();
    try {
      await db.exec(`INSERT INTO series_fixed_rates VALUES('${series}','${role}',220); INSERT INTO event_assignments(event_id,staff_role_id) VALUES('${event}','${role}'); UPDATE series_fixed_rates SET fixed_rate=250;`);
      expect((await db.query('SELECT unit_price FROM quote_items')).rows).toEqual([{unit_price:'275'}]);
    } finally { await db.close(); }
  });
  it('preserves standard pay outside a series and blocks direct snapshot editing', async () => {
    const db = await setup();
    try {
      await db.exec(`UPDATE events SET event_series_id=NULL; INSERT INTO event_assignments(event_id,staff_role_id) VALUES('${event}','${role}');`);
      expect((await db.query("SELECT pay_rate_snapshot->>'hourly_rate' AS rate FROM event_assignments")).rows).toEqual([{rate:'40'}]);
      await expect(db.exec(`UPDATE event_assignments SET pay_rate_snapshot='{}'`)).rejects.toThrow('cannot be edited directly');
    } finally { await db.close(); }
  });
});