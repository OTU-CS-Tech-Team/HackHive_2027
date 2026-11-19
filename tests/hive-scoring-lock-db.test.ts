import { PGlite } from '@electric-sql/pglite';
import { readFile } from 'node:fs/promises';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest';

// Runs the scoring-lock migration in isolated PostgreSQL, never the shared project.
const db = new PGlite();
const app = (n: number) => `00000000-0000-0000-0000-${String(n).padStart(12, '0')}`;

beforeAll(async () => {
  await db.exec(`
    create role anon nologin; create role authenticated nologin; create role service_role nologin;
    create function public.is_admin() returns boolean language sql stable as $$ select false $$;
    create table public.profiles(id uuid primary key);
    create table public.applications(id uuid primary key, status text not null, phone text, submitted_at timestamptz);
    grant usage on schema public to anon, authenticated, service_role;
  `);
  await db.exec(await readFile('supabase/migrations/20261118000000_hive_scores.sql', 'utf8'));
  await db.exec(await readFile('supabase/migrations/20261120000000_hive_scoring_lock.sql', 'utf8'));
}, 30000);
beforeEach(async () => {
  await db.exec('begin;');
  await db.exec(`insert into public.applications values
    ('${app(1)}', 'submitted', '+1 (905) 555-0100', '2026-11-01'),
    ('${app(2)}', 'submitted', '905.555.0100', '2026-11-02'),
    ('${app(3)}', 'submitted', '123', '2026-11-03'),
    ('${app(4)}', 'draft', null, null);`);
});
afterEach(async () => { await db.exec('rollback;'); });
afterAll(async () => { await db.close(); });

type Claim = { claim_token: string; attempts: number; status: string; flags: string[] };
const claim = async (n: number) => (await db.query<Claim>(`select * from public.claim_hive_score('${app(n)}')`)).rows;
const backlog = async (limit = 10, max = 5) =>
  (await db.query<{ application_id: string; total: number }>(`select * from public.hive_backlog(1, ${limit}, ${max})`)).rows;
const scored = (n: number) =>
  db.exec(`insert into public.hive_scores (application_id, status, built_it, shipped, impact, beyond_tutorial,
    experience, creativity, quality, suggested_tier, scored_at, prompt_version)
    values ('${app(n)}', 'scored', true, true, false, false, 3, 4, 4, 'worker', now(), 1);`);

describe('applications.phone_digits', () => {
  it('matches normalizePhone: last 10 digits, or null when too short', async () => {
    const { rows } = await db.query<{ phone_digits: string | null }>('select phone_digits from public.applications order by id');
    expect(rows.map((row) => row.phone_digits)).toEqual(['9055550100', '9055550100', null, null]);
  });
});

describe('claim_hive_score', () => {
  it('claims a new applicant once; a second claim gets nothing', async () => {
    const [first] = await claim(1);
    expect(first).toMatchObject({ attempts: 1, status: 'pending', flags: [] });
    expect(first.claim_token).toBeTruthy();
    expect(await claim(1)).toEqual([]);
  });

  it('takes over a claim older than 2 minutes and counts the try', async () => {
    await claim(1);
    await db.exec(`update public.hive_scores set claimed_at = now() - interval '3 minutes' where application_id = '${app(1)}';`);
    expect(await claim(1)).toMatchObject([{ attempts: 2, status: 'pending' }]);
  });

  it("keeps a scored applicant's status while re-scoring", async () => {
    await scored(1);
    expect(await claim(1)).toMatchObject([{ status: 'scored', attempts: 1 }]);
    const { rows } = await db.query<{ suggested_tier: string }>(`select suggested_tier from public.hive_scores where application_id = '${app(1)}'`);
    expect(rows[0].suggested_tier).toBe('worker');
  });

  it("can't be called by signed-in users", async () => {
    await db.exec('set local role authenticated;');
    await expect(claim(1)).rejects.toThrow(/permission denied/);
  });
});

describe('hive_backlog', () => {
  it('lists submitted applicants not scored with the current prompt, oldest first, with the total', async () => {
    await scored(2);
    expect(await backlog()).toEqual([
      { application_id: app(1), total: 2 },
      { application_id: app(3), total: 2 },
    ]);
  });

  it('puts repeat failures last and drops them after the max', async () => {
    await db.exec(`insert into public.hive_scores (application_id, status, attempts) values ('${app(1)}', 'failed', 2), ('${app(2)}', 'failed', 5);`);
    expect((await backlog()).map((row) => row.application_id)).toEqual([app(3), app(1)]);
  });

  it('skips applicants being scored right now, and counts outdated scores', async () => {
    await claim(1);
    await scored(2);
    await db.exec(`update public.hive_scores set prompt_version = 0 where application_id = '${app(2)}';`);
    expect((await backlog()).map((row) => row.application_id)).toEqual([app(2), app(3)]);
  });

  it('honours the limit but still reports the total', async () => {
    expect(await backlog(1)).toEqual([{ application_id: app(1), total: 3 }]);
  });
});

describe('add_hive_flag', () => {
  it('adds the flag once, only to the given rows', async () => {
    await scored(1);
    await scored(2);
    await db.exec(`select public.add_hive_flag(array['${app(1)}']::uuid[], 'possible_duplicate');`);
    await db.exec(`select public.add_hive_flag(array['${app(1)}']::uuid[], 'possible_duplicate');`);
    const { rows } = await db.query<{ flags: string[] }>('select flags from public.hive_scores order by application_id');
    expect(rows.map((row) => row.flags)).toEqual([['possible_duplicate'], []]);
  });
});
