// @vitest-environment node
import { PGlite } from '@electric-sql/pglite';
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

async function setup() {
  const db = new PGlite();
  await db.exec(`
    CREATE ROLE anon; CREATE ROLE authenticated; CREATE ROLE service_role;
    CREATE SCHEMA auth;
    CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql AS $$ SELECT NULL::uuid $$;
    CREATE FUNCTION public.has_role(uuid,text) RETURNS boolean LANGUAGE sql AS $$ SELECT false $$;
    CREATE TABLE events(id uuid PRIMARY KEY,event_name text,event_date date,start_time time,end_time time,setup_time text,timezone text,venue_name text,ops_status text);
    CREATE TABLE event_sessions(id uuid PRIMARY KEY,event_id uuid,session_date date,start_time time,end_time time,arrival_time time,timezone text,venue_name text);
    CREATE TABLE profiles(id uuid PRIMARY KEY,phone text,is_active boolean);
    CREATE TABLE staff(id uuid PRIMARY KEY,user_id uuid,name text,phone text,status text);
    CREATE TABLE staff_roles(id uuid PRIMARY KEY,name text,is_onsite boolean);
    CREATE TABLE event_assignments(id uuid PRIMARY KEY,event_id uuid,staff_id uuid,user_id uuid,staff_role_id uuid,session_id uuid,confirmation_status text);
  `);
  await db.exec(readFileSync('drizzle/migrations/0028_crew_sms_reminders.sql', 'utf8'));
  await db.exec(readFileSync('drizzle/migrations/0029_hourly_crew_sms_window.sql', 'utf8'));
  await db.exec(`
    INSERT INTO crew_sms_settings VALUES(true,true,now()-interval '1 minute');
    INSERT INTO events SELECT '00000000-0000-0000-0000-000000000001','SMS test',(now()+interval '24 hours'-interval '30 seconds')::date,'12:00',now()::time,to_char(now()+interval '24 hours'-interval '30 seconds','HH24:MI:SS'),'UTC','Test venue','ready';
    INSERT INTO profiles VALUES('00000000-0000-0000-0000-000000000002','0412345678',true);
    INSERT INTO staff_roles VALUES('00000000-0000-0000-0000-000000000003','Photographer',true);
    INSERT INTO event_assignments VALUES('00000000-0000-0000-0000-000000000004','00000000-0000-0000-0000-000000000001',NULL,'00000000-0000-0000-0000-000000000002','00000000-0000-0000-0000-000000000003',NULL,'confirmed');
  `);
  return db;
}

describe('scheduled crew SMS database rules', () => {
  it('still selects reminders one hour after their target time', async () => {
    const db = await setup();
    try {
      await db.exec(`UPDATE crew_sms_settings SET enabled_at=now()-interval '2 hours'; UPDATE events SET event_date=(now()+interval '23 hours')::date,setup_time=to_char(now()+interval '23 hours','HH24:MI:SS');`);
      expect((await db.query(`SELECT reminder_type FROM crew_sms_candidates()`)).rows).toEqual([{reminder_type:'setup'}]);
    } finally { await db.close(); }
  });
  it('selects the setup reminder 24 hours before the stored Setup time', async () => {
    const db = await setup();
    try {
      const { rows } = await db.query<{ reminder_type: string; elapsed: number }>(`SELECT reminder_type,extract(epoch from(setup_at-due_at))::integer AS elapsed FROM crew_sms_candidates()`);
      expect(rows).toEqual([{ reminder_type: 'setup', elapsed: 86400 }]);
    } finally { await db.close(); }
  });
  it('uses the finish time for delivery reminders', async () => {
    const db = await setup();
    try {
      await db.exec(`UPDATE events SET event_date=(now()-interval '30 seconds')::date,start_time='00:00',end_time=(now()-interval '30 seconds')::time,setup_time='00:00';`);
      const { rows } = await db.query(`SELECT reminder_type,due_at=finish_at AS exact FROM crew_sms_candidates()`);
      expect(rows).toEqual([{ reminder_type: 'delivery', exact: true }]);
    } finally { await db.close(); }
  });
  it('excludes cancelled events before sending', async () => {
    const db = await setup();
    try {
      expect((await db.query('SELECT * FROM crew_sms_candidates()')).rows).toHaveLength(1);
      await db.exec(`UPDATE events SET ops_status='cancelled';`);
      expect((await db.query('SELECT * FROM crew_sms_candidates()')).rows).toHaveLength(0);
    } finally { await db.close(); }
  });
  it('prevents duplicate claims across overlapping scheduled runs', async () => {
    const db = await setup();
    try {
      const claim = `INSERT INTO crew_sms_logs(event_id,session_key,recipient_key,reminder_type,due_at,phone,body) VALUES('00000000-0000-0000-0000-000000000001','event','crew','setup',now(),'0412345678','Reminder')`;
      await db.exec(claim);
      await expect(db.exec(claim)).rejects.toThrow('duplicate key');
      expect((await db.query('SELECT * FROM crew_sms_logs')).rows).toHaveLength(1);
    } finally { await db.close(); }
  });
  it('consumes a scheduler ticket only once', async () => {
    const db = await setup();
    try {
      await db.exec(`INSERT INTO crew_sms_dispatch_tickets(token) VALUES('00000000-0000-0000-0000-000000000005');`);
      expect((await db.query(`SELECT consume_crew_sms_ticket('00000000-0000-0000-0000-000000000005') AS ok`)).rows).toEqual([{ok:true}]);
      expect((await db.query(`SELECT consume_crew_sms_ticket('00000000-0000-0000-0000-000000000005') AS ok`)).rows).toEqual([{ok:false}]);
    } finally { await db.close(); }
  });
});

describe('MASV ASAP delivery flag', () => {
  const MASV_ASAP = '00000000-0000-0000-0000-000000000010';
  const DROPBOX = '00000000-0000-0000-0000-000000000011';

  async function flagSetup() {
    const db = new PGlite();
    await db.exec(`
      CREATE TABLE delivery_methods_lookup(id uuid PRIMARY KEY, name text);
      CREATE TABLE events(id uuid PRIMARY KEY, delivery_method_photographer_id uuid, crew_sms_masv_delivery boolean DEFAULT false);
      INSERT INTO delivery_methods_lookup VALUES('${MASV_ASAP}','MASV ASAP'),('${DROPBOX}','Dropbox');
    `);
    await db.exec(readFileSync('drizzle/migrations/0033_crew_sms_masv_auto_from_delivery_method.sql', 'utf8'));
    return db;
  }

  it('flags the event when the photographer delivery method is MASV ASAP', async () => {
    const db = await flagSetup();
    try {
      await db.exec(`INSERT INTO events(id,delivery_method_photographer_id) VALUES('00000000-0000-0000-0000-000000000001','${MASV_ASAP}');`);
      expect((await db.query('SELECT crew_sms_masv_delivery AS masv FROM events')).rows).toEqual([{ masv: true }]);
    } finally { await db.close(); }
  });

  it('clears the flag when the delivery method changes away from MASV ASAP', async () => {
    const db = await flagSetup();
    try {
      await db.exec(`INSERT INTO events(id,delivery_method_photographer_id) VALUES('00000000-0000-0000-0000-000000000001','${MASV_ASAP}');`);
      await db.exec(`UPDATE events SET delivery_method_photographer_id='${DROPBOX}';`);
      expect((await db.query('SELECT crew_sms_masv_delivery AS masv FROM events')).rows).toEqual([{ masv: false }]);
    } finally { await db.close(); }
  });
});