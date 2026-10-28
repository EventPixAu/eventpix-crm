// @vitest-environment node
import { PGlite } from '@electric-sql/pglite';
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { assignmentRateSnapshot } from './assignmentRateSnapshot';

const product = '22222222-0001-0001-0001-000000000004';
const role = '3da8ec25-8aec-4e66-b5fa-3519ae24782d';
const event = '00000000-0000-0000-0000-000000000001';
const item = '00000000-0000-0000-0000-000000000002';
const first = '00000000-0000-0000-0000-000000000003';
const second = '00000000-0000-0000-0000-000000000004';

async function setup() {
  const db = new PGlite();
  await db.exec(`CREATE ROLE anon; CREATE ROLE authenticated; CREATE ROLE service_role;
    CREATE SCHEMA auth; CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql AS $$SELECT '${event}'::uuid$$;
    CREATE FUNCTION has_role(uuid,text) RETURNS boolean LANGUAGE sql AS $$SELECT true$$;
    CREATE FUNCTION can_access_operations(uuid) RETURNS boolean LANGUAGE sql AS $$SELECT false$$;
    CREATE TABLE products(id uuid PRIMARY KEY,unit_price numeric);
    CREATE TABLE staff_roles(id uuid PRIMARY KEY,name text,is_onsite boolean);
    CREATE TABLE profiles(id uuid PRIMARY KEY,is_salaried boolean);
    CREATE TABLE pay_rate_card(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),staff_role_id uuid,hourly_rate numeric,minimum_paid_hours numeric,rate_mode text,fixed_rate numeric,created_at timestamptz DEFAULT now(),updated_at timestamptz DEFAULT now());
    CREATE TABLE events(id uuid PRIMARY KEY,quote_id uuid,lead_id uuid);
    CREATE TABLE quotes(id uuid PRIMARY KEY,event_id uuid,lead_id uuid);
    CREATE TABLE quote_items(id uuid PRIMARY KEY,quote_id uuid,product_id uuid,quantity numeric,unit_price numeric);
    CREATE TABLE event_assignments(id uuid PRIMARY KEY,event_id uuid,staff_role_id uuid,user_id uuid,hourly_rate_override numeric);
    INSERT INTO products VALUES('${product}',275);
    INSERT INTO staff_roles VALUES('${role}','Photographer',true);
    INSERT INTO pay_rate_card(staff_role_id,hourly_rate,minimum_paid_hours,rate_mode) VALUES('${role}',125,2,'hourly');
    INSERT INTO events VALUES('${event}',NULL,NULL);
    INSERT INTO event_assignments(id,event_id,staff_role_id) VALUES('${first}','${event}','${role}');
  `);
  await db.exec(readFileSync('drizzle/migrations/0039_product_unit_rates_and_lighting_pay.sql', 'utf8'));
  await db.exec(readFileSync('drizzle/migrations/0040_separate_client_and_team_rates.sql', 'utf8'));
  await db.exec(`INSERT INTO quotes VALUES('${event}','${event}',NULL);
    INSERT INTO quote_items VALUES('${item}','${event}','d085ab8f-4793-41be-a38b-012a3a44baed',1,160);
    INSERT INTO event_assignments(id,event_id,staff_role_id) VALUES('${second}','${event}','${role}');`);
  return db;
}

describe('standard Products rates and lighting pay', () => {
  it('starts at client $275 and photographer $125 per unit', async () => {
    const db = await setup();
    try { expect((await db.query('SELECT unit_price,photographer_unit_rate FROM products')).rows).toEqual([{unit_price:'275',photographer_unit_rate:'125'}]); }
    finally { await db.close(); }
  });
  it('annual increases affect new assignments, not saved pay or client items', async () => {
    const db = await setup();
    try {
      await db.exec(`UPDATE products SET unit_price=300; UPDATE pay_rate_card SET hourly_rate=135; INSERT INTO event_assignments(id,event_id,staff_role_id) VALUES('${item}','${event}','${role}');`);
      const rows = (await db.query<{ id: string; pay_rate_snapshot: { hourly_rate: number; minimum_paid_hours: number } }>('SELECT id,pay_rate_snapshot FROM event_assignments')).rows;
      expect(assignmentRateSnapshot(rows.find(r => r.id === first) ?? {}, {hourly_rate:135,minimum_paid_hours:2})?.hourly_rate).toBe(125);
      expect(rows.find(r => r.id === item)?.pay_rate_snapshot.hourly_rate).toBe(135);
      expect((await db.query('SELECT unit_price FROM quote_items')).rows).toEqual([{unit_price:'160'}]);
    } finally { await db.close(); }
  });
  it('allocates exactly one $125 unit to one selected photographer without duplicates', async () => {
    const db = await setup();
    try {
      await db.exec(`SELECT allocate_lighting_pay('${item}','${first}'); SELECT allocate_lighting_pay('${item}','${first}');`);
      expect((await db.query('SELECT assignment_id,unit_rate FROM quote_lighting_pay')).rows).toEqual([{assignment_id:first,unit_rate:'125'}]);
      await db.exec(`UPDATE pay_rate_card SET hourly_rate=135; SELECT allocate_lighting_pay('${item}','${second}');`);
      expect((await db.query('SELECT assignment_id,unit_rate FROM quote_lighting_pay')).rows).toEqual([{assignment_id:second,unit_rate:'125'}]);
    } finally { await db.close(); }
  });
  it('keeps client Products rates and team Pay Rates independent', async () => {
    const db = await setup();
    try {
      await db.exec('UPDATE products SET unit_price=300;');
      expect((await db.query('SELECT hourly_rate FROM pay_rate_card')).rows).toEqual([{hourly_rate:'125'}]);
      await db.exec('UPDATE pay_rate_card SET hourly_rate=135;');
      expect((await db.query('SELECT unit_price FROM products')).rows).toEqual([{unit_price:'300'}]);
    } finally { await db.close(); }
  });
  it('uses the selected assignment hourly pay, not the client product rate, for lighting', async () => {
    const db = await setup();
    try {
      await db.exec(`UPDATE event_assignments SET hourly_rate_override=140 WHERE id='${first}'; SELECT allocate_lighting_pay('${item}','${first}');`);
      expect((await db.query('SELECT unit_rate FROM quote_lighting_pay')).rows).toEqual([{unit_rate:'140'}]);
    } finally { await db.close(); }
  });
  it('rejects staff self-allocation', async () => {
    const db = await setup();
    try {
      await db.exec('CREATE OR REPLACE FUNCTION has_role(uuid,text) RETURNS boolean LANGUAGE sql AS $$SELECT false$$;');
      await expect(db.exec(`SELECT allocate_lighting_pay('${item}','${first}');`)).rejects.toThrow('Only event managers');
    } finally { await db.close(); }
  });
  it('rejects allocation to a different event and cleans pay when the item is removed', async () => {
    const db = await setup();
    try {
      await db.exec(`UPDATE event_assignments SET event_id='${second}' WHERE id='${second}';`);
      await expect(db.exec(`SELECT allocate_lighting_pay('${item}','${second}');`)).rejects.toThrow('this budget event');
      await db.exec(`SELECT allocate_lighting_pay('${item}','${first}'); DELETE FROM quote_items WHERE id='${item}';`);
      expect((await db.query('SELECT * FROM quote_lighting_pay')).rows).toHaveLength(0);
    } finally { await db.close(); }
  });
});