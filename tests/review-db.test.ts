import { PGlite } from '@electric-sql/pglite';
import { readFile } from 'node:fs/promises';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest';

// Runs the blind review migration in isolated PostgreSQL, never the shared project.
// is_admin() and auth.uid() read per-transaction settings so both paths can be tested.
const db = new PGlite();
const app = (n: number) => `00000000-0000-0000-0000-${String(n).padStart(12, '0')}`;
const admin = (n: number) => `aaaaaaaa-0000-0000-0000-${String(n).padStart(12, '0')}`;
const A = admin(1);
const B = admin(2);
const C = admin(3);

beforeAll(async () => {
  await db.exec(`
    create role anon nologin; create role authenticated nologin; create role service_role nologin;
    create schema auth;
    create function auth.uid() returns uuid language sql stable as $$
      select nullif(current_setting('test.uid', true), '')::uuid;
    $$;
    create function public.is_admin() returns boolean language sql stable as $$
      select coalesce(nullif(current_setting('test.admin', true), ''), 'false')::boolean;
    $$;
    create table public.profiles(id uuid primary key);
    create table public.applications(id uuid primary key, user_id uuid, status text not null, decision text,
      university text, year_of_study text, submitted_at timestamptz);
    grant usage on schema public to anon, authenticated, service_role;
    grant usage on schema auth to anon, authenticated, service_role;
    grant select on public.applications to authenticated;
    insert into public.profiles values ('${A}'), ('${B}'), ('${C}');
  `);
  await db.exec(await readFile('supabase/migrations/20261118000000_hive_scores.sql', 'utf8'));
  await db.exec(await readFile('supabase/migrations/20261121000000_blind_review.sql', 'utf8'));
}, 30000);

beforeEach(async () => {
  await db.exec('begin;');
  await db.exec(`insert into public.applications (id, status, submitted_at) select
      ('00000000-0000-0000-0000-' || lpad(n::text, 12, '0'))::uuid, 'submitted', now() - n * interval '1 minute' from generate_series(1, 6) n;
    insert into public.hive_scores (application_id, status, built_it, shipped, impact, beyond_tutorial,
      experience, creativity, quality, suggested_tier, scored_at)
    select id, 'scored', true, true, true, true, 5, 4, 4, 'queen', now() from public.applications;`);
});
// set local role ends with the transaction; rollback also clears an aborted one.
afterEach(async () => { await db.exec('rollback;'); });
afterAll(async () => { await db.close(); });

const as = (uid: string, isAdmin = true) =>
  db.exec(`set local role authenticated; select set_config('test.admin','${isAdmin}',true), set_config('test.uid','${uid}',true);`);
const asOwner = () => db.exec(`reset role;`);

const claim = async (uid: string, tier = 'queen') => {
  await as(uid);
  const { rows } = await db.query<{ application_id: string; applicant_no: number }>(`select * from public.claim_next_review('${tier}')`);
  return rows[0]?.application_id ?? null;
};
type Vote = { result: string; pool: string | null; waitlist_position: number | null };
const vote = async (uid: string, id: string, choice: string) => {
  await as(uid);
  const { rows } = await db.query<Vote>(`select * from public.cast_review_vote('${id}', '${choice}')`);
  return rows[0];
};
/** Sets the school and year the pools are worked out from. */
const profile = (id: string, otu: boolean, lower: boolean) =>
  db.exec(`reset role; update public.applications set university = ${otu ? "'Ontario Tech University'" : "'McMaster University'"},
    year_of_study = '${lower ? '1' : '3'}' where id = '${id}';`);
/** Claims then votes, as the queue page does. Asserts the claim gives `id`. */
const claimAndVote = async (uid: string, id: string, choice: string, otu = false, lower = false) => {
  await profile(id, otu, lower);
  // Point the claim straight at `id` so tests don't depend on the random order.
  await db.exec(`delete from public.review_claims where application_id = '${id}';
    insert into public.review_claims (application_id, admin_id, tier) values ('${id}', '${uid}', 'queen');`);
  return vote(uid, id, choice);
};
const setSeats = (otu: number, lower: number, general: number) =>
  db.exec(`reset role; update public.review_settings set otu_seats = ${otu}, lower_years_seats = ${lower}, general_seats = ${general};`);
const outcome = async (id: string) => {
  await asOwner();
  const { rows } = await db.query<{ outcome: string; pool: string | null; waitlist_position: number | null }>(
    `select outcome, pool, waitlist_position from public.review_outcomes where application_id = '${id}'`,
  );
  return rows[0] ?? null;
};
/** Only app(n) is reviewable in the queen tier; the rest move to another tier. */
const onlyQueens = (...ns: number[]) =>
  db.exec(`reset role; update public.hive_scores set suggested_tier = 'worker'
    where application_id not in (${ns.map((n) => `'${app(n)}'`).join(',')});`);

describe('applicant numbers', () => {
  it('numbers every submitted application, uniquely', async () => {
    const { rows } = await db.query<{ applicant_no: number }>('select applicant_no from public.applications');
    expect(new Set(rows.map((row) => row.applicant_no)).size).toBe(6);
    expect(rows.every((row) => Number.isInteger(row.applicant_no))).toBe(true);
  });

  it('hands out a number on submit only, and nobody can change it', async () => {
    const draft = app(50);
    await db.exec(`insert into public.applications (id, status) values ('${draft}', 'draft');
      update public.applications set university = 'x' where id = '${draft}';`);
    const no = async () =>
      (await db.query<{ applicant_no: number | null }>(`select applicant_no from public.applications where id = '${draft}'`)).rows[0].applicant_no;
    expect(await no()).toBeNull(); // autosaves don't use up numbers
    await db.exec(`update public.applications set status = 'submitted' where id = '${draft}';`);
    const given = await no();
    expect(given).toEqual(expect.any(Number));
    await db.exec(`update public.applications set applicant_no = 1 where id = '${draft}';`);
    expect(await no()).toBe(given);
  });
});

describe('claim_next_review', () => {
  it('gives you the same person again on refresh', async () => {
    const first = await claim(A);
    expect(first).toBeTruthy();
    expect(await claim(A)).toBe(first);
  });

  it("never gives someone another admin has open, until their claim is 15 minutes old", async () => {
    await onlyQueens(1);
    expect(await claim(A)).toBe(app(1));
    expect(await claim(B)).toBeNull();
    await db.exec(`reset role; update public.review_claims set claimed_at = now() - interval '16 minutes';`);
    expect(await claim(B)).toBe(app(1));
  });

  it("skips people you've voted on or skipped, and people with an outcome", async () => {
    await onlyQueens(1, 2, 3);
    await claimAndVote(A, app(1), 'yes');
    await claimAndVote(A, app(2), 'skip');
    await claimAndVote(B, app(3), 'no');
    await claimAndVote(C, app(3), 'no'); // rejected
    expect(await claim(A)).toBeNull();
    expect(await claim(B)).toBe(app(1));
  });

  it('puts people who already have a vote first', async () => {
    await claimAndVote(A, app(4), 'yes');
    for (let i = 0; i < 5; i++) {
      await asOwner();
      await db.exec(`delete from public.review_claims;`);
      expect(await claim(B)).toBe(app(4));
    }
  });

  it('a skip does not count as a vote for priority', async () => {
    await onlyQueens(1, 2);
    await claimAndVote(A, app(1), 'skip');
    const seen = new Set<string | null>();
    for (let i = 0; i < 30; i++) {
      await asOwner();
      await db.exec(`delete from public.review_claims;`);
      seen.add(await claim(B));
    }
    expect(seen).toEqual(new Set([app(1), app(2)]));
  });

  it('only offers scored, undecided applicants in the tier asked for', async () => {
    await asOwner();
    await db.exec(`update public.hive_scores set status = 'pending', suggested_tier = null, scored_at = null where application_id = '${app(1)}';
      update public.applications set decision = 'accepted' where id = '${app(2)}';
      update public.hive_scores set suggested_tier = 'larva' where application_id not in ('${app(1)}', '${app(2)}', '${app(3)}');`);
    expect(await claim(A, 'queen')).toBe(app(3));
  });

  it('never gives you your own application', async () => {
    await onlyQueens(1);
    await db.exec(`reset role; update public.applications set user_id = '${A}' where id = '${app(1)}';`);
    expect(await claim(A)).toBeNull();
    expect(await claim(B)).toBe(app(1));
  });

  it('refuses non-admins and bad tiers', async () => {
    await as(A, false);
    await expect(db.query(`select * from public.claim_next_review('queen')`)).rejects.toThrow(/Admins only/);
    await db.exec('rollback; begin;');
    await as(A);
    await expect(db.query(`select * from public.claim_next_review('drone')`)).rejects.toThrow(/Unknown tier/);
  });

  it('is not callable signed out', async () => {
    await db.exec('set local role anon;');
    await expect(db.query(`select * from public.claim_next_review('queen')`)).rejects.toThrow(/permission denied/);
  });
});

describe('cast_review_vote', () => {
  it('2 Yes from an OTU student goes into the OTU pool', async () => {
    await claimAndVote(A, app(1), 'yes', true, true);
    expect(await outcome(app(1))).toBeNull();
    expect(await claimAndVote(B, app(1), 'yes', true, true)).toEqual({ result: 'accepted', pool: 'otu', waitlist_position: null });
  });

  it('fills Ontario Tech, then lower years, then everyone else, then the waitlist', async () => {
    await setSeats(3, 2, 5);
    await asOwner();
    await db.exec(`insert into public.applications (id, status) select
        ('00000000-0000-0000-0000-' || lpad(n::text, 12, '0'))::uuid, 'submitted' from generate_series(7, 20) n;`);
    const place = async (n: number, otu: boolean, lower: boolean) => {
      await claimAndVote(A, app(n), 'yes', otu, lower);
      return claimAndVote(B, app(n), 'yes', otu, lower);
    };
    const results = [];
    for (let n = 1; n <= 4; n++) results.push(await place(n, true, true)); // 3 OTU, then early
    for (let n = 5; n <= 6; n++) results.push(await place(n, false, true)); // 1 lower year, then general
    for (let n = 7; n <= 11; n++) results.push(await place(n, false, false)); // general fills at 5
    results.push(await place(12, true, true)); // all full
    results.push(await place(13, false, false));
    expect(results.map((r) => r.pool ?? `waitlist #${r.waitlist_position}`)).toEqual([
      'otu', 'otu', 'otu', 'lower_years', 'lower_years', 'general', 'general', 'general', 'general', 'general',
      'waitlist #1', 'waitlist #2', 'waitlist #3',
    ]);
  });

  it('counts people accepted by hand towards the pools', async () => {
    await setSeats(1, 1, 5);
    await asOwner();
    await db.exec(`update public.applications set decision = 'accepted', university = 'UOIT', year_of_study = '1' where id in ('${app(5)}', '${app(6)}');`);
    // app(6) submitted first: takes the one OTU seat; app(5) (also OTU) overflows into lower years.
    await as(A);
    const { rows } = await db.query<{ pool: string; filled: number; target: number }>('select * from public.review_pool_counts()');
    expect(rows).toEqual([
      { pool: 'otu', filled: 1, target: 1 },
      { pool: 'lower_years', filled: 1, target: 1 },
      { pool: 'general', filled: 0, target: 5 },
    ]);
    await claimAndVote(A, app(1), 'yes', true, true);
    expect(await claimAndVote(B, app(1), 'yes', true, true)).toMatchObject({ result: 'accepted', pool: 'general' });
  });

  it('2 No rejects', async () => {
    await claimAndVote(A, app(1), 'no');
    expect(await claimAndVote(B, app(1), 'no')).toMatchObject({ result: 'rejected' });
    expect(await outcome(app(1))).toMatchObject({ outcome: 'rejected', pool: null });
  });

  it('a 1-1 split waits for a third admin, whose vote decides', async () => {
    expect(await claimAndVote(A, app(1), 'yes')).toMatchObject({ result: 'pending' });
    expect(await claimAndVote(B, app(1), 'no')).toMatchObject({ result: 'pending' });
    expect(await outcome(app(1))).toBeNull();
    expect(await claim(C)).toBe(app(1)); // split comes first in the queue
    expect(await vote(C, app(1), 'yes')).toMatchObject({ result: 'accepted', pool: 'general' });
  });

  it("a skip isn't a vote", async () => {
    await claimAndVote(A, app(1), 'skip');
    await claimAndVote(B, app(1), 'yes');
    expect(await claimAndVote(C, app(1), 'yes')).toMatchObject({ result: 'accepted' });
  });

  it("refuses a vote without the claim, a second vote, and votes on decided people", async () => {
    expect(await vote(A, app(1), 'yes')).toMatchObject({ result: 'not_claimed' });
    await claimAndVote(A, app(1), 'yes');
    expect(await claimAndVote(A, app(1), 'no')).toMatchObject({ result: 'already_voted' });
    await claimAndVote(B, app(1), 'yes');
    expect(await claimAndVote(C, app(1), 'no')).toMatchObject({ result: 'decided' });
  });

  it("won't count a vote on someone already decided by hand, or on your own application", async () => {
    await db.exec(`reset role; update public.applications set decision = 'accepted' where id = '${app(2)}';
      update public.applications set user_id = '${A}' where id = '${app(3)}';`);
    expect(await claimAndVote(A, app(2), 'no')).toMatchObject({ result: 'decided' });
    expect(await claimAndVote(A, app(3), 'yes')).toMatchObject({ result: 'own_application' });
    await asOwner();
    const { rows } = await db.query(`select 1 from public.review_votes where application_id in ('${app(2)}', '${app(3)}')`);
    expect(rows).toEqual([]);
  });

  it('closes your claim when you vote', async () => {
    const id = (await claim(A))!;
    await vote(A, id, 'yes');
    await asOwner();
    const { rows } = await db.query(`select 1 from public.review_claims where application_id = '${id}'`);
    expect(rows).toEqual([]);
  });

  it('locks the settings row so two votes landing together cannot overfill a pool', async () => {
    // PGlite has one connection, so the race itself can't be run here; check the lock is taken
    // before anything is counted, and that a full pool overflows to the next one.
    const { rows } = await db.query<{ def: string }>(`select pg_get_functiondef('public.cast_review_vote(uuid,text)'::regprocedure) as def`);
    const def = rows[0].def;
    expect(def).toMatch(/from public\.review_settings where id = 1 for update/);
    expect(def.indexOf('for update')).toBeLessThan(def.indexOf('count(*)'));

    await setSeats(0, 0, 1);
    await claimAndVote(A, app(1), 'yes', true);
    expect(await claimAndVote(B, app(1), 'yes', true)).toMatchObject({ pool: 'general' });
    await claimAndVote(A, app(2), 'yes');
    expect(await claimAndVote(B, app(2), 'yes')).toMatchObject({ result: 'waitlisted', waitlist_position: 1 });
  });

  it('refuses non-admins and unknown votes', async () => {
    await as(A, false);
    await expect(db.query(`select * from public.cast_review_vote('${app(1)}', 'yes')`)).rejects.toThrow(/Admins only/);
    await db.exec('rollback; begin;');
    await as(A);
    await expect(db.query(`select * from public.cast_review_vote('${app(1)}', 'maybe')`)).rejects.toThrow(/Unknown vote/);
  });

  it("can't write votes, claims or outcomes directly", async () => {
    await as(A);
    await expect(db.exec(`insert into public.review_votes values ('${app(1)}', '${A}', 'yes')`)).rejects.toThrow(/permission denied/);
    await db.exec('rollback; begin;');
    await as(A);
    await expect(db.exec(`insert into public.review_outcomes (application_id, outcome) values ('${app(1)}', 'rejected')`)).rejects.toThrow(/permission denied/);
  });
});

describe('reopen_review', () => {
  const accept = async (n: number) => {
    await claimAndVote(A, app(n), 'yes');
    await claimAndVote(B, app(n), 'yes');
  };
  const reopen = async (n: number) => {
    await as(A);
    const { rows } = await db.query<{ reopen_review: boolean }>(`select public.reopen_review('${app(n)}')`);
    return rows[0].reopen_review;
  };

  it('clears the outcome and the Yes/No votes, freeing the seat', async () => {
    await setSeats(0, 0, 1);
    await accept(1);
    expect(await reopen(1)).toBe(true);
    expect(await outcome(app(1))).toBeNull();
    const { rows: votes } = await db.query(`select 1 from public.review_votes where application_id = '${app(1)}'`);
    expect(votes).toEqual([]);
    await accept(2);
    expect(await outcome(app(2))).toMatchObject({ outcome: 'accepted', pool: 'general' });
  });

  it('keeps "I know this person" skips, so that admin still never gets them', async () => {
    await onlyQueens(1);
    await claimAndVote(C, app(1), 'skip');
    await accept(1);
    expect(await reopen(1)).toBe(true);
    expect(await claim(C)).toBeNull();
    expect(await claim(A)).toBe(app(1));
  });

  it('refuses once a decision is set or staged for them', async () => {
    await accept(1);
    await accept(2);
    await db.exec(`reset role; update public.applications set decision = 'accepted' where id = '${app(1)}';
      create table public.staged_decisions (application_id uuid primary key, decision text);
      insert into public.staged_decisions values ('${app(2)}', 'accepted');`);
    expect(await reopen(1)).toBe(false);
    expect(await reopen(2)).toBe(false);
    expect(await outcome(app(1))).not.toBeNull();
    expect(await outcome(app(2))).not.toBeNull();
  });

  it('refuses non-admins', async () => {
    await as(A, false);
    await expect(db.query(`select public.reopen_review('${app(1)}')`)).rejects.toThrow(/Admins only/);
    await db.exec('rollback; begin;');
    await as(A, false);
    await expect(db.query(`select * from public.review_pool_counts()`)).rejects.toThrow(/Admins only/);
  });
});

describe('review_notes', () => {
  it('admins add notes as themselves only; non-admins see nothing', async () => {
    await as(A);
    await db.exec(`insert into public.review_notes (application_id, author_id, body) values ('${app(1)}', '${A}', 'Strong resume')`);
    await expect(db.exec(`insert into public.review_notes (application_id, author_id, body) values ('${app(1)}', '${B}', 'x')`)).rejects.toThrow(/row-level security/);
    await db.exec('rollback; begin;');
    await as(A, false);
    const { rows } = await db.query('select * from public.review_notes');
    expect(rows).toEqual([]);
  });
});
