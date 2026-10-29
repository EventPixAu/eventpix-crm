// @vitest-environment node
import { PGlite } from '@electric-sql/pglite';
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

async function setup(clock?: string) {
  const db = new PGlite();
  await db.exec(`
    CREATE ROLE anon; CREATE ROLE authenticated; CREATE ROLE service_role;
    CREATE SCHEMA auth;
    CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql AS $$ SELECT '00000000-0000-0000-0000-000000000099'::uuid $$;
    CREATE FUNCTION public.has_role(uuid,text) RETURNS boolean LANGUAGE sql AS $$ SELECT coalesce(current_setting('test.is_admin',true),'false')='true' $$;
    CREATE TABLE events(id uuid PRIMARY KEY,event_name text,event_date date,start_time time,end_time time,setup_time text,timezone text,venue_name text,ops_status text,crew_sms_masv_delivery boolean DEFAULT false);
    CREATE TABLE event_sessions(id uuid PRIMARY KEY,event_id uuid,session_date date,start_time time,end_time time,arrival_time time,timezone text,venue_name text,session_type text DEFAULT 'live');
    CREATE TABLE profiles(id uuid PRIMARY KEY,phone text,is_active boolean);
    CREATE TABLE staff(id uuid PRIMARY KEY,user_id uuid,name text,phone text,status text);
    CREATE TABLE staff_roles(id uuid PRIMARY KEY,name text,is_onsite boolean);
    CREATE TABLE event_assignments(id uuid PRIMARY KEY,event_id uuid,staff_id uuid,user_id uuid,staff_role_id uuid,session_id uuid,confirmation_status text);
  `);
  await db.exec(readFileSync('drizzle/migrations/0028_crew_sms_reminders.sql', 'utf8'));
  await db.exec(readFileSync('drizzle/migrations/0029_hourly_crew_sms_window.sql', 'utf8'));
  await db.exec(readFileSync('drizzle/migrations/0034_crew_sms_manual_followup.sql', 'utf8'));
  const timingSql = readFileSync('drizzle/migrations/0043_crew_sms_editing_delivery_timing.sql', 'utf8');
  await db.exec(timingSql);
  await db.exec(readFileSync('drizzle/migrations/0044_crew_sms_masv_scheduled_delivery_priority.sql', 'utf8'));
  await db.exec(readFileSync('drizzle/migrations/0045_crew_sms_shared_schedule_preview.sql', 'utf8'));
  await db.exec(readFileSync('drizzle/migrations/0046_crew_sms_individual_switches.sql', 'utf8'));
  if (clock) await db.exec(`DO $$ DECLARE definition text; BEGIN SELECT pg_get_functiondef('public.crew_sms_candidates()'::regprocedure) INTO definition; EXECUTE replace(definition,'now()','timestamptz ''${clock}'''); END $$;`);
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
  it('switches off only the selected recipient/session/type while retaining its preview', async () => {
    const db = await setup();
    try {
      await db.exec(`SET test.is_admin='true';
        UPDATE events SET setup_time=to_char(now()+interval '24 hours'-interval '30 seconds','HH24:MI:SS');
        INSERT INTO profiles VALUES('00000000-0000-0000-0000-000000000008','0499999999',true);
        INSERT INTO event_assignments SELECT '00000000-0000-0000-0000-000000000009',event_id,NULL,'00000000-0000-0000-0000-000000000008',staff_role_id,NULL,'confirmed' FROM event_assignments LIMIT 1;
        SELECT set_crew_sms_reminder_enabled('00000000-0000-0000-0000-000000000001','event','00000000-0000-0000-0000-000000000002','delivery',false);
      `);
      // Another reminder type remains due for the same recipient.
      expect((await db.query('SELECT * FROM crew_sms_candidates()')).rows).toHaveLength(2);
      await db.exec(`SELECT set_crew_sms_reminder_enabled('00000000-0000-0000-0000-000000000001','different-session','00000000-0000-0000-0000-000000000002','setup',false);`);
      expect((await db.query('SELECT * FROM crew_sms_candidates()')).rows).toHaveLength(2);
      await db.exec(`SELECT set_crew_sms_reminder_enabled('00000000-0000-0000-0000-000000000001','event','00000000-0000-0000-0000-000000000002','setup',false);`);
      expect((await db.query('SELECT recipient_key FROM crew_sms_candidates()')).rows).toEqual([{recipient_key:'00000000-0000-0000-0000-000000000008'}]);
      expect((await db.query(`SELECT * FROM crew_sms_schedule(now()-interval '65 minutes',now()+interval '1 microsecond') WHERE reminder_type='setup'`)).rows).toHaveLength(2);
      expect((await db.query('SELECT * FROM crew_sms_logs')).rows).toHaveLength(0);
    } finally { await db.close(); }
  });
  it('can switch a disabled text back on without creating send claims', async () => {
    const db = await setup();
    try {
      await db.exec(`SET test.is_admin='true'; SELECT set_crew_sms_reminder_enabled('00000000-0000-0000-0000-000000000001','event','00000000-0000-0000-0000-000000000002','setup',false);`);
      expect((await db.query('SELECT * FROM crew_sms_candidates()')).rows).toHaveLength(0);
      await db.exec(`SELECT set_crew_sms_reminder_enabled('00000000-0000-0000-0000-000000000001','event','00000000-0000-0000-0000-000000000002','setup',true);`);
      expect((await db.query('SELECT reminder_type FROM crew_sms_candidates()')).rows).toEqual([{reminder_type:'setup'}]);
      expect((await db.query('SELECT * FROM crew_sms_disabled_reminders')).rows).toHaveLength(0);
      expect((await db.query('SELECT * FROM crew_sms_logs')).rows).toHaveLength(0);
    } finally { await db.close(); }
  });
  it('rejects switch changes from non-admin users', async () => {
    const db = await setup();
    try {
      await expect(db.exec(`SELECT set_crew_sms_reminder_enabled('00000000-0000-0000-0000-000000000001','event','crew','setup',false);`)).rejects.toThrow('Admin access required');
      expect((await db.query('SELECT * FROM crew_sms_disabled_reminders')).rows).toHaveLength(0);
    } finally { await db.close(); }
  });
  it('does not report a processed or in-flight text as switched off', async () => {
    const db = await setup();
    try {
      await db.exec(`SET test.is_admin='true'; INSERT INTO crew_sms_logs(event_id,session_key,recipient_key,reminder_type,due_at,phone,body) VALUES('00000000-0000-0000-0000-000000000001','event','crew','setup',now(),'0412345678','Reminder');`);
      await expect(db.exec(`SELECT set_crew_sms_reminder_enabled('00000000-0000-0000-0000-000000000001','event','crew','setup',false);`)).rejects.toThrow('already being sent');
    } finally { await db.close(); }
  });
  it('previews only reminders in the requested next-seven-days window without creating logs', async () => {
    const db = await setup();
    try {
      await db.exec(`UPDATE crew_sms_settings SET enabled_at='2026-10-01'; UPDATE events SET event_date='2026-11-02',setup_time='09:00',end_time='17:00',timezone='Australia/Sydney';`);
      expect((await db.query(`SELECT reminder_type FROM crew_sms_schedule('2026-10-29T16:24:00+11:00','2026-11-05T16:24:00+11:00') ORDER BY due_at`)).rows).toEqual([{reminder_type:'setup'},{reminder_type:'delivery'}]);
      await db.exec(`UPDATE events SET event_date='2026-11-07';`);
      expect((await db.query(`SELECT * FROM crew_sms_schedule('2026-10-29T16:24:00+11:00','2026-11-05T16:24:00+11:00')`)).rows).toHaveLength(0);
      expect((await db.query('SELECT * FROM crew_sms_logs')).rows).toHaveLength(0);
    } finally { await db.close(); }
  });
  async function editingSetup(clock: string) {
    const db = await setup(clock);
    await db.exec(`
      UPDATE crew_sms_settings SET enabled_at='2026-10-23T00:00:00Z';
      UPDATE events SET event_date='2026-10-30',start_time='18:30',end_time='21:30',setup_time='18:15',timezone='Australia/Hobart';
      INSERT INTO event_sessions(id,event_id,session_date,start_time,end_time,arrival_time,timezone,session_type) VALUES
      ('00000000-0000-0000-0000-000000000006','00000000-0000-0000-0000-000000000001','2026-10-30','18:30','21:30','18:15','Australia/Hobart','live'),
      ('00000000-0000-0000-0000-000000000007','00000000-0000-0000-0000-000000000001','2026-11-02','09:00','17:00','09:00','Australia/Hobart','post_production');
    `);
    return db;
  }
  it('delays Friday files until Sunday 9am for Monday 9am editing', async () => {
    const db = await editingSetup('2026-11-01T09:00:00+11:00');
    try {
      const { rows } = await db.query(`SELECT reminder_type,session_key,due_at=timestamptz '2026-11-01T09:00:00+11:00' AS exact FROM crew_sms_candidates()`);
      expect(rows).toEqual([{reminder_type:'delivery',session_key:'00000000-0000-0000-0000-000000000006',exact:true}]);
    } finally { await db.close(); }
  });
  it('does not send standard delivery at Friday finish when editing is Monday', async () => {
    const db = await editingSetup('2026-10-30T22:00:00+11:00');
    try { expect((await db.query('SELECT * FROM crew_sms_candidates()')).rows).toHaveLength(0); }
    finally { await db.close(); }
  });
  it('does not send MASV at Friday finish when post-event delivery is Monday', async () => {
    const db = await editingSetup('2026-10-30T22:00:00+11:00');
    try {
      await db.exec('UPDATE events SET crew_sms_masv_delivery=true');
      expect((await db.query('SELECT * FROM crew_sms_candidates()')).rows).toHaveLength(0);
    } finally { await db.close(); }
  });
  it('sends MASV on Sunday 9am for Monday 9am post-event delivery', async () => {
    const db = await editingSetup('2026-11-01T09:00:00+11:00');
    try {
      await db.exec('UPDATE events SET crew_sms_masv_delivery=true');
      expect((await db.query(`SELECT reminder_type,due_at=timestamptz '2026-11-01T09:00:00+11:00' AS exact FROM crew_sms_candidates()`)).rows).toEqual([{reminder_type:'delivery',exact:true}]);
    } finally { await db.close(); }
  });
  it('retains MASV finish reminders only without scheduled post-event delivery', async () => {
    const db = await editingSetup('2026-10-30T22:00:00+11:00');
    try {
      await db.exec(`UPDATE events SET crew_sms_masv_delivery=true; DELETE FROM event_sessions WHERE session_type='post_production';`);
      expect((await db.query(`SELECT reminder_type,due_at=timestamptz '2026-10-30T21:30:00+11:00' AS exact FROM crew_sms_candidates()`)).rows).toEqual([{reminder_type:'delivery',exact:true}]);
    } finally { await db.close(); }
  });
  it('does not send photographer setup texts for the Monday editing session', async () => {
    const db = await editingSetup('2026-11-01T09:00:00+11:00');
    try { expect((await db.query(`SELECT * FROM crew_sms_candidates() WHERE reminder_type='setup'`)).rows).toHaveLength(0); }
    finally { await db.close(); }
  });
  it('retains delayed delivery for shoots older than the previous two-day scan limit', async () => {
    const db = await editingSetup('2026-11-01T09:00:00+11:00');
    try {
      await db.exec(`UPDATE events SET event_date='2026-10-26'; UPDATE event_sessions SET session_date='2026-10-26' WHERE session_type='live';`);
      expect((await db.query(`SELECT reminder_type FROM crew_sms_candidates()`)).rows).toEqual([{reminder_type:'delivery'}]);
    } finally { await db.close(); }
  });
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

describe('manual follow-up texts', () => {
  const EVENT = '00000000-0000-0000-0000-000000000001';
  it('lists confirmed onsite crew for a finished event regardless of the schedule', async () => {
    const db = await setup();
    try {
      await db.exec(`UPDATE events SET event_date=(now()-interval '1 day')::date;`);
      const { rows } = await db.query(`SELECT recipient_key, phone FROM crew_sms_followup_recipients('${EVENT}')`);
      expect(rows).toEqual([{ recipient_key: '00000000-0000-0000-0000-000000000002', phone: '0412345678' }]);
    } finally { await db.close(); }
  });
  it('excludes cancelled events from manual follow-ups', async () => {
    const db = await setup();
    try {
      await db.exec(`UPDATE events SET ops_status='cancelled';`);
      expect((await db.query(`SELECT * FROM crew_sms_followup_recipients('${EVENT}')`)).rows).toHaveLength(0);
    } finally { await db.close(); }
  });
  it('allows follow-up entries in the send log', async () => {
    const db = await setup();
    try {
      await db.exec(`INSERT INTO crew_sms_logs(event_id,session_key,recipient_key,reminder_type,due_at,phone,body) VALUES('${EVENT}','event:followup:1','crew','followup',now(),'0412345678','Follow up')`);
      expect((await db.query(`SELECT reminder_type FROM crew_sms_logs`)).rows).toEqual([{ reminder_type: 'followup' }]);
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