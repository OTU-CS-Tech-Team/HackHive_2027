import { PGlite } from '@electric-sql/pglite';
import { readFile } from 'node:fs/promises';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest';

// Runs the release-waves migration in isolated PostgreSQL, never the shared project.
// auth.uid() and is_admin() read settings, so each test picks who's calling.
const db = new PGlite();
const app = (n: number) => `00000000-0000-0000-0000-${String(n).padStart(12, '0')}`;
const ADMIN = 'aaaaaaaa-0000-0000-0000-000000000001';
const HACKER = 'bbbbbbbb-0000-0000-0000-000000000002';

beforeAll(async () => {
  await db.exec(`
    create role anon nologin; create role authenticated nologin; create role service_role nologin;
    create schema auth;
    create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('test.uid', true), '')::uuid $$;
    create function public.is_admin() returns boolean language sql stable as $$ select coalesce(current_setting('test.admin', true), '') = 'on' $$;
    create table public.profiles(id uuid primary key);
    create table public.applications(
      id uuid primary key,
      status text not null,
      email text not null,
      first_name text,
      decision text check (decision in ('accepted', 'waitlisted', 'rejected'))
    );
    -- Same rule as 20261020000000_application_decisions.sql.
    create function public.protect_application_decision() returns trigger language plpgsql set search_path = '' as $$
    begin
      if new.decision is distinct from (case when tg_op = 'UPDATE' then old.decision end)
         and auth.uid() is not null and not public.is_admin() then
        raise exception 'Only admins can set a decision';
      end if;
      return new;
    end;
    $$;
    create trigger applications_protect_decision before insert or update on public.applications
      for each row execute function public.protect_application_decision();
    alter table public.applications enable row level security;
    create policy admin_all on public.applications for all to authenticated using (public.is_admin()) with check (public.is_admin());
    grant select, update on public.applications to authenticated;
    grant usage on schema public, auth to anon, authenticated, service_role;
    grant select, insert, update, delete on public.profiles to authenticated;
    insert into public.profiles values ('${ADMIN}'), ('${HACKER}');
  `);
  // Supabase grants table privileges to authenticated by default; RLS does the rest.
  await db.exec('alter default privileges in schema public grant all on tables to authenticated, anon;');
  const migration = await readFile('supabase/migrations/20261122000000_release_waves.sql', 'utf8');
  await db.exec(migration);
  await db.exec(migration); // safe to run twice
}, 30000);

beforeEach(async () => {
  await db.exec('begin;');
  await db.exec(`insert into public.applications values
    ('${app(1)}', 'submitted', 'one@test.com', 'One', null),
    ('${app(2)}', 'submitted', 'two@test.com', 'Two', null),
    ('${app(3)}', 'submitted', 'three@test.com', 'Three', null),
    ('${app(4)}', 'submitted', 'four@test.com', 'Four', 'waitlisted'),
    ('${app(5)}', 'draft', 'five@test.com', null, null);`);
  await asAdmin();
});
afterEach(async () => {
  await db.exec('rollback;');
});
afterAll(async () => {
  await db.close();
});

async function asAdmin() {
  await db.exec(`set local role authenticated; set local test.uid = '${ADMIN}'; set local test.admin = 'on';`);
}
async function asHacker() {
  await db.exec(`set local role authenticated; set local test.uid = '${HACKER}'; set local test.admin = 'off';`);
}

const stage = (n: number, decision: string) =>
  db.exec(`insert into public.staged_decisions (application_id, decision, staged_by) values ('${app(n)}', '${decision}', '${ADMIN}');`);
// Tests run inside one transaction, where now() is fixed, so staged_at defaults to the cutoff.
const release = async (final = false, cutoff = 'now()') =>
  (await db.query<{ wave_id: number; released: number }>(`select * from public.release_wave(${final}, ${cutoff})`)).rows[0].wave_id;
const decisions = async () =>
  (await db.query<{ id: string; decision: string | null }>('select id, decision from public.applications order by id')).rows.map(
    (row) => row.decision,
  );
const staged = async () =>
  (await db.query<{ application_id: string; decision: string }>('select application_id, decision from public.staged_decisions order by application_id'))
    .rows;
const emails = async () =>
  (await db.query<{ wave_id: number; application_id: string; decision: string }>(
    'select wave_id, application_id, decision from public.wave_emails order by wave_id, application_id',
  )).rows;
type Claim = { application_id: string; decision: string; email: string; first_name: string | null };
const claim = async (wave: number, limit = 10) =>
  (await db.query<Claim>(`select * from public.claim_wave_emails(${wave}, ${limit})`)).rows;

describe('staged_decisions', () => {
  it('is invisible to applicants', async () => {
    await stage(1, 'accepted');
    await asHacker();
    expect(await staged()).toEqual([]);
    await expect(stage(2, 'accepted')).rejects.toThrow(/row-level security/);
  });
});

describe('release_wave', () => {
  it('moves staged decisions onto applications and logs one email each', async () => {
    await stage(1, 'accepted');
    await stage(2, 'waitlisted');

    const wave = await release();

    expect(await decisions()).toEqual(['accepted', 'waitlisted', null, 'waitlisted', null]);
    expect(await staged()).toEqual([]);
    expect(await emails()).toEqual([
      { wave_id: wave, application_id: app(1), decision: 'accepted' },
      { wave_id: wave, application_id: app(2), decision: 'waitlisted' },
    ]);
    const { rows } = await db.query<{ released_by: string; includes_rejections: boolean }>('select * from public.release_waves');
    expect(rows).toMatchObject([{ released_by: ADMIN, includes_rejections: false }]);
  });

  it('holds rejections back until the final wave', async () => {
    await stage(1, 'accepted');
    await stage(3, 'rejected');

    await release();
    expect(await decisions()).toEqual(['accepted', null, null, 'waitlisted', null]);
    expect(await staged()).toEqual([{ application_id: app(3), decision: 'rejected' }]);

    const wave = await release(true);
    expect(await decisions()).toEqual(['accepted', null, 'rejected', 'waitlisted', null]);
    expect((await emails()).filter((row) => row.wave_id === wave)).toEqual([{ wave_id: wave, application_id: app(3), decision: 'rejected' }]);
  });

  it('drops staged decisions they already have', async () => {
    await stage(4, 'waitlisted');
    await stage(1, 'accepted');

    await release();

    expect(await staged()).toEqual([]);
    expect((await emails()).map((row) => row.application_id)).toEqual([app(1)]);
  });

  it('promotes a waitlisted applicant', async () => {
    await stage(4, 'accepted');
    await release();
    expect((await decisions())[3]).toBe('accepted');
  });

  it("says when there's nothing to release, and creates no wave", async () => {
    // A failed statement aborts the transaction, so each try gets a savepoint.
    const fails = async () => {
      await db.exec('savepoint s;');
      await expect(release()).rejects.toThrow('Nothing to release');
      await db.exec('rollback to savepoint s;');
    };
    await fails();
    await stage(3, 'rejected'); // held back without the final wave
    await fails();
    await stage(5, 'accepted'); // a draft
    await fails();
    const { rows } = await db.query<{ count: number }>('select count(*)::int as count from public.release_waves');
    expect(rows[0].count).toBe(0);
  });

  it('cancels an older unsent email for someone released again', async () => {
    await stage(1, 'waitlisted');
    const first = await release();
    await stage(1, 'accepted');
    const second = await release();

    expect(await emails()).toEqual([{ wave_id: second, application_id: app(1), decision: 'accepted' }]);
    expect(await claim(first)).toEqual([]);
  });

  it('blocks people who are not admins', async () => {
    await stage(1, 'accepted');
    await asHacker();
    await expect(release()).rejects.toThrow('Admins only');
  });

  it('says how many it released', async () => {
    await stage(1, 'accepted');
    await stage(2, 'waitlisted');
    const { rows } = await db.query<{ released: number }>('select * from public.release_wave(false, now())');
    expect(rows[0].released).toBe(2);
  });

  it('leaves anything staged after the cutoff for the next wave', async () => {
    await stage(1, 'accepted');
    // Staged (or changed) after the admin loaded the page they confirmed on.
    await db.exec(`insert into public.staged_decisions (application_id, decision, staged_at) values ('${app(2)}', 'accepted', now() + interval '1 second');`);

    await release();

    expect(await decisions()).toEqual(['accepted', null, null, 'waitlisted', null]);
    expect(await staged()).toEqual([{ application_id: app(2), decision: 'accepted' }]);
  });

  it('refuses while an earlier wave is mid-send, so its old email cannot go out after the new one', async () => {
    await stage(1, 'waitlisted');
    const first = await release();
    expect(await claim(first)).toHaveLength(1); // a batch is sending the waitlist email
    await stage(1, 'accepted');

    await db.exec('savepoint s;');
    await expect(release()).rejects.toThrow('Emails are still sending');
    await db.exec('rollback to savepoint s;');

    // Once that claim is stale (the batch died), releasing works again.
    await db.exec("update public.wave_emails set claimed_at = now() - interval '3 minutes';");
    const second = await release();
    expect(await emails()).toEqual([{ wave_id: second, application_id: app(1), decision: 'accepted' }]);
  });

  it("can't be written to directly by admins", async () => {
    await expect(db.exec('insert into public.release_waves (includes_rejections) values (false);')).rejects.toThrow(/permission denied/);
  });
});

describe('claim_wave_emails', () => {
  it('hands each email out once, with who to send it to', async () => {
    await stage(1, 'accepted');
    await stage(2, 'waitlisted');
    const wave = await release();

    const first = await claim(wave, 1);
    expect(first).toEqual([{ application_id: app(1), decision: 'accepted', email: 'one@test.com', first_name: 'One' }]);
    expect((await claim(wave)).map((row) => row.application_id)).toEqual([app(2)]);
    expect(await claim(wave)).toEqual([]);
  });

  it('re-claims an unsent email after 2 minutes but never a sent one', async () => {
    await stage(1, 'accepted');
    await stage(2, 'accepted');
    const wave = await release();
    await claim(wave);
    await db.exec(`update public.wave_emails set sent_at = now(), claimed_at = null where application_id = '${app(2)}';`);
    await db.exec("update public.wave_emails set claimed_at = now() - interval '3 minutes';");

    const again = await claim(wave);

    expect(again.map((row) => row.application_id)).toEqual([app(1)]);
    const { rows } = await db.query<{ attempts: number }>(`select attempts from public.wave_emails where application_id = '${app(1)}'`);
    expect(rows[0].attempts).toBe(2);
  });

  it('gives applicants nothing', async () => {
    await stage(1, 'accepted');
    const wave = await release();
    await asHacker();
    expect(await claim(wave)).toEqual([]);
  });
});
