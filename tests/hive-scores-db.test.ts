import { PGlite } from '@electric-sql/pglite';
import { readFile } from 'node:fs/promises';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest';

// Exercise the actual migration in isolated PostgreSQL, never the shared project.
const db = new PGlite();
const APP = '00000000-0000-0000-0000-00000000000a';
const ADMIN = '00000000-0000-0000-0000-0000000000ad';

beforeAll(async () => {
  await db.exec(`
    create role anon nologin; create role authenticated nologin;
    create function public.is_admin() returns boolean language sql stable as $$
      select coalesce(current_setting('test.admin',true),'false')::boolean;
    $$;
    create table public.profiles(id uuid primary key);
    create table public.applications(id uuid primary key);
    grant usage on schema public to anon, authenticated;
    insert into public.profiles values ('${ADMIN}');
    insert into public.applications values ('${APP}');
  `);
  await db.exec(await readFile('supabase/migrations/20261118000000_hive_scores.sql', 'utf8'));
  // Supabase grants table access to these roles by default; RLS does the gating.
  await db.exec(`
    grant select, insert, update, delete on public.hive_scores to authenticated;
    grant select on public.hive_tier_changes to authenticated;
  `);
}, 30000);
beforeEach(async () => {
  await db.exec('begin;');
  await db.exec(`insert into public.hive_scores (application_id, status, built_it, shipped, impact, beyond_tutorial,
    experience, creativity, quality, suggested_tier, scored_at)
    values ('${APP}', 'scored', true, true, false, false, 3, 4, 4, 'worker', now());`);
});
afterEach(async () => { await db.exec('rollback;'); });
afterAll(async () => { await db.close(); });

const as = (admin: boolean) =>
  db.exec(`set local role authenticated; select set_config('test.admin','${admin}',true);`);
const tier = async () =>
  (await db.query<{ tier: string }>(`select tier from public.hive_scores where application_id = '${APP}'`)).rows[0]?.tier;

describe('hive_scores', () => {
  it('uses the suggested tier until an admin overrides it', async () => {
    expect(await tier()).toBe('worker');
    await as(true);
    await db.exec(`update public.hive_scores set tier_override = 'queen', override_reason = 'Resume shows shipped apps',
      overridden_by = '${ADMIN}', overridden_at = now() where application_id = '${APP}';`);
    expect(await tier()).toBe('queen');
  });

  it('logs every override with who and why', async () => {
    await as(true);
    await db.exec(`update public.hive_scores set tier_override = 'queen', override_reason = 'Strong resume',
      overridden_by = '${ADMIN}' where application_id = '${APP}';`);
    await db.exec(`update public.hive_scores set tier_override = null, override_reason = 'Back to suggested'
      where application_id = '${APP}';`);
    const { rows } = await db.query('select from_tier, to_tier, reason, changed_by from public.hive_tier_changes order by id');
    expect(rows).toEqual([
      { from_tier: 'worker', to_tier: 'queen', reason: 'Strong resume', changed_by: ADMIN },
      { from_tier: 'queen', to_tier: 'worker', reason: 'Back to suggested', changed_by: ADMIN },
    ]);
  });

  it('refuses an override without a reason', async () => {
    await expect(db.exec(`update public.hive_scores set tier_override = 'larva', override_reason = '  ',
      overridden_by = '${ADMIN}' where application_id = '${APP}';`)).rejects.toThrow(/override_explained/);
  });

  it('refuses a scored row with missing grades', async () => {
    await expect(db.exec(`update public.hive_scores set quality = null where application_id = '${APP}';`))
      .rejects.toThrow(/scored_complete/);
  });

  it('hides scores and the log from non-admins', async () => {
    await as(false);
    expect(await tier()).toBeUndefined();
    await db.exec(`update public.hive_scores set tier_override = 'queen', override_reason = 'x',
      overridden_by = '${ADMIN}' where application_id = '${APP}';`);
    await as(true);
    expect(await tier()).toBe('worker');
  });

  it("doesn't let admins write the log directly", async () => {
    await as(true);
    await expect(db.exec(`insert into public.hive_tier_changes (application_id, to_tier) values ('${APP}', 'queen');`))
      .rejects.toThrow(/permission denied/);
  });
});
