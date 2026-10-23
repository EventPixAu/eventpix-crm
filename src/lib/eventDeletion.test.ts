import { PGlite } from '@electric-sql/pglite';
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

async function setup(admin = true) {
  const db = new PGlite();
  await db.exec(`
    CREATE ROLE anon; CREATE ROLE authenticated;
    CREATE SCHEMA auth;
    CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql AS $$ SELECT '00000000-0000-0000-0000-000000000001'::uuid $$;
    CREATE TYPE app_role AS ENUM ('admin');
    CREATE FUNCTION has_role(uuid, app_role) RETURNS boolean LANGUAGE sql AS $$ SELECT ${admin} $$;
    CREATE TABLE events(id uuid PRIMARY KEY, quote_id uuid);
    CREATE TABLE quotes(id uuid PRIMARY KEY, event_id uuid REFERENCES events(id), linked_event_id uuid REFERENCES events(id), lead_id uuid, scope text, status text, is_locked boolean);
    ALTER TABLE events ADD FOREIGN KEY (quote_id) REFERENCES quotes(id);
  `);
  await db.exec(readFileSync('drizzle/migrations/0027_safe_event_delete.sql', 'utf8'));
  await db.exec(`
    INSERT INTO events VALUES ('00000000-0000-0000-0000-000000000002', NULL);
    INSERT INTO quotes VALUES ('00000000-0000-0000-0000-000000000003', '00000000-0000-0000-0000-000000000002', NULL, NULL, 'event', 'draft', false);
    UPDATE events SET quote_id='00000000-0000-0000-0000-000000000003';
  `);
  return db;
}

describe('event deletion', () => {
  it('removes an accidental event and its draft budget despite circular references', async () => {
    const db = await setup();
    try {
      await db.exec(`SELECT delete_event_safely('00000000-0000-0000-0000-000000000002');`);
      expect((await db.query('SELECT * FROM events')).rows).toHaveLength(0);
      expect((await db.query('SELECT * FROM quotes')).rows).toHaveLength(0);
    } finally { await db.close(); }
  });

  it('does not permit non-admin deletion', async () => {
    const db = await setup(false);
    try {
      await expect(db.exec(`SELECT delete_event_safely('00000000-0000-0000-0000-000000000002');`)).rejects.toThrow('Only admins');
      expect((await db.query('SELECT * FROM events')).rows).toHaveLength(1);
    } finally { await db.close(); }
  });

  it('preserves an accepted budget and its event', async () => {
    const db = await setup();
    try {
      await db.exec(`UPDATE quotes SET status='accepted', is_locked=true;`);
      await expect(db.exec(`SELECT delete_event_safely('00000000-0000-0000-0000-000000000002');`)).rejects.toThrow('accepted budget');
      expect((await db.query('SELECT * FROM events')).rows).toHaveLength(1);
      expect((await db.query('SELECT status FROM quotes')).rows).toEqual([{ status: 'accepted' }]);
    } finally { await db.close(); }
  });
});