import { PGlite } from '@electric-sql/pglite';
import { readFile } from 'node:fs/promises';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest';

// Blind review and release waves together (20261123000000_review_decisions.sql),
// in isolated PostgreSQL, never the shared project.
const db = new PGlite();
const app = (n: number) => `00000000-0000-0000-0000-${String(n).padStart(12, '0')}`;
const A = 'aaaaaaaa-0000-0000-0000-000000000001';

beforeAll(async () => {
  await db.exec(`
    create role anon nologin; create role authenticated nologin; create role service_role nologin;
    create schema auth;
    create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('test.uid', true), '')::uuid $$;
    create function public.is_admin() returns boolean language sql stable as $$
      select coalesce(nullif(current_setting('test.admin', true), ''), 'false')::boolean;
    $$;
    create table public.profiles(id uuid primary key);
    create table public.applications(id uuid primary key, user_id uuid, status text not null, email text not null default 'x@test.com',
      first_name text, decision text, university text, year_of_study text, submitted_at timestamptz);
    grant usage on schema public, auth to anon, authenticated, service_role;
    grant select on public.applications to authenticated;
    insert into public.profiles values ('${A}');
  `);
  await db.exec('alter default privileges in schema public grant all on tables to authenticated, anon;');
  for (const file of [
    '20261118000000_hive_scores',
    '20261121000000_blind_review',
    '20261122000000_release_waves',
    '20261123000000_review_decisions',
    '20261124000000_staged_clock_and_votes',
  ]) {
    await db.exec(await readFile(`supabase/migrations/${file}.sql`, 'utf8'));
  }
  // Safe to run twice.
  await db.exec(await readFile('supabase/migrations/20261123000000_review_decisions.sql', 'utf8'));
  await db.exec(await readFile('supabase/migrations/20261124000000_staged_clock_and_votes.sql', 'utf8'));
}, 30000);

beforeEach(async () => {
  await db.exec('begin;');
  await db.exec(`insert into public.applications (id, status, submitted_at, university, year_of_study)
    select ('00000000-0000-0000-0000-' || lpad(n::text, 12, '0'))::uuid, 'submitted', now() - (20 - n) * interval '1 minute',
      'McMaster University', '3'
    from generate_series(1, 10) n;
    insert into public.hive_scores (application_id, status, built_it, shipped, impact, beyond_tutorial,
      experience, creativity, quality, suggested_tier, scored_at)
    select id, 'scored', true, true, true, true, 5, 4, 4, 'queen', now() from public.applications;
    update public.review_settings set otu_seats = 2, lower_years_seats = 1, general_seats = 3;`);
});
afterEach(async () => {
  await db.exec('rollback;');
});
afterAll(async () => {
  await db.close();
});

const asAdmin = () => db.exec(`set local role authenticated; set local test.uid = '${A}'; set local test.admin = 'true';`);
const asOwner = () => db.exec('reset role;');
const set = (n: number, fields: string) => db.exec(`reset role; update public.applications set ${fields} where id = '${app(n)}';`);
const placed = (n: number, pool: string) =>
  db.exec(`reset role; insert into public.review_outcomes (application_id, outcome, pool) values ('${app(n)}', 'accepted', '${pool}');`);
// staged_at is stamped by the database, so rows are staged in the order they're inserted.
const stage = (n: number, decision: string) =>
  db.exec(`reset role; insert into public.staged_decisions (application_id, decision) values ('${app(n)}', '${decision}');`);
const counts = async () => {
  await asAdmin();
  const { rows } = await db.query<{ pool: string; filled: number }>('select pool, filled from public.review_pool_counts()');
  return Object.fromEntries(rows.map((row) => [row.pool, row.filled]));
};

describe('review_pool_counts', () => {
  it('counts review placements, released accepts and staged accepts', async () => {
    await placed(1, 'otu');
    await set(2, "decision = 'accepted', university = 'UOIT'");
    await stage(3, 'accepted');
    expect(await counts()).toEqual({ otu: 2, lower_years: 0, general: 1 });
  });

  it("drops a review placement once a different decision is staged or released", async () => {
    await placed(1, 'otu');
    await placed(2, 'general');
    await stage(1, 'rejected');
    await set(2, "decision = 'waitlisted'");
    expect(await counts()).toEqual({ otu: 0, lower_years: 0, general: 0 });
  });

  it('drops a released accept that is staged to something else', async () => {
    await set(1, "decision = 'accepted'");
    await stage(1, 'waitlisted');
    expect(await counts()).toEqual({ otu: 0, lower_years: 0, general: 0 });
  });

  it('slots hand accepts in: review seats first, then released by submission, then staged in order', async () => {
    await placed(1, 'otu'); // review takes an Ontario Tech seat first
    await set(6, "university = 'Ontario Tech University', year_of_study = '1'");
    await stage(6, 'accepted'); // staged first: OTU is full by then, so lower years
    await set(9, "university = 'Ontario Tech University'");
    await stage(9, 'accepted'); // staged second
    await set(5, "decision = 'accepted', university = 'Ontario Tech University'"); // released: counts before any staged one, takes the last OTU seat
    expect(await counts()).toEqual({ otu: 2, lower_years: 1, general: 1 }); // app 9 overflows to general
  });

  it('a vote can no longer take a seat a staged accept is holding', async () => {
    await db.exec(`reset role; update public.review_settings set otu_seats = 0, lower_years_seats = 0, general_seats = 1;`);
    await stage(1, 'accepted');
    await db.exec(`reset role; insert into public.review_votes (application_id, admin_id, vote) values ('${app(2)}', '${A}', 'yes');
      insert into public.profiles values ('bbbbbbbb-0000-0000-0000-000000000002');
      insert into public.review_claims (application_id, admin_id, tier) values ('${app(2)}', 'bbbbbbbb-0000-0000-0000-000000000002', 'queen');`);
    await db.exec(`set local role authenticated; set local test.uid = 'bbbbbbbb-0000-0000-0000-000000000002'; set local test.admin = 'true';`);
    const { rows } = await db.query<{ result: string }>(`select result from public.cast_review_vote('${app(2)}', 'yes')`);
    expect(rows[0].result).toBe('waitlisted');
  });
});

describe('claim_next_review', () => {
  it('never deals someone with a staged decision', async () => {
    await asOwner();
    await db.exec(`update public.hive_scores set suggested_tier = 'worker' where application_id not in ('${app(1)}', '${app(2)}');`);
    await stage(1, 'accepted');
    await stage(2, 'rejected');
    await asAdmin();
    const { rows } = await db.query('select * from public.claim_next_review($1)', ['queen']);
    expect(rows).toEqual([]);
  });

  it('drops a claim you already had once they are staged', async () => {
    await asOwner();
    await db.exec(`update public.hive_scores set suggested_tier = 'worker' where application_id <> '${app(1)}';`);
    await asAdmin();
    const first = await db.query<{ application_id: string }>('select * from public.claim_next_review($1)', ['queen']);
    expect(first.rows[0].application_id).toBe(app(1));
    await stage(1, 'waitlisted');
    await asAdmin();
    const again = await db.query('select * from public.claim_next_review($1)', ['queen']);
    expect(again.rows).toEqual([]);
  });
});

describe('staged_at', () => {
  // In microseconds: rows a moment apart can share a millisecond.
  const stampedAt = async (n: number) =>
    Number(
      (await db.query<{ us: string }>(`select (extract(epoch from staged_at) * 1000000)::bigint::text as us from public.staged_decisions where application_id = '${app(n)}'`))
        .rows[0].us,
    );

  it("is the database's clock, whatever the caller sends", async () => {
    await db.exec(`reset role; insert into public.staged_decisions (application_id, decision, staged_at) values ('${app(1)}', 'accepted', '2000-01-01');`);
    expect(await stampedAt(1)).toBeGreaterThan(Date.parse('2026-01-01') * 1000);
  });

  it('moves forward when a decision is re-staged, so the release cutoff sees it as new', async () => {
    await stage(1, 'accepted');
    const first = await stampedAt(1);
    await db.query('select pg_sleep(0.01)'); // the test database's clock is coarser than Postgres's
    await db.exec(`reset role; update public.staged_decisions set decision = 'rejected', staged_at = '2000-01-01' where application_id = '${app(1)}';`);
    expect(await stampedAt(1)).toBeGreaterThan(first);
  });
});

describe('cast_review_vote', () => {
  it("won't record an outcome for someone staged while their card was open", async () => {
    await db.exec(`reset role; insert into public.review_claims (application_id, admin_id, tier) values ('${app(1)}', '${A}', 'queen');`);
    await stage(1, 'rejected');
    await asAdmin();
    const { rows } = await db.query<{ result: string }>(`select result from public.cast_review_vote('${app(1)}', 'yes')`);
    expect(rows[0].result).toBe('decided');
    await asOwner();
    expect((await db.query('select * from public.review_votes')).rows).toEqual([]);
    expect((await db.query('select * from public.review_outcomes')).rows).toEqual([]);
  });
});
