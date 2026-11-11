import { PGlite } from '@electric-sql/pglite';
import { readFile } from 'node:fs/promises';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';

const db = new PGlite();
const migration = (name: string) => readFile(`supabase/migrations/${name}.sql`, 'utf8');
const USER = '11111111-1111-4111-8111-111111111111';

type SubmitResult = { ok?: boolean; error?: string; application_id?: string; submitted_at?: string };

async function submit(overrides: Record<string, unknown> = {}): Promise<SubmitResult> {
  const args: Record<string, unknown> = {
    p_submission_id: 'sub-1', p_first_name: 'Ada', p_last_name: 'Lovelace', p_phone: '4165550100', p_age: 21,
    p_pronouns: null, p_city: 'Toronto', p_country: 'Canada', p_university: 'University of Toronto', p_program: 'CS',
    p_year_of_study: '3', p_grad_date: null, p_hackathons_count: null, p_linkedin_url: null, p_github_url: null,
    p_portfolio_url: null, p_resume_path: `${USER}/resume.pdf`, p_q_proud: 'a', p_q_hack: 'b', p_q_anything_else: null,
    p_team_status: 'solo', p_teammate_emails: null, p_dietary: null, p_accessibility: null, p_tshirt_size: 'M',
    p_needs_travel_help: null, p_gender: null, p_ethnicity: null, p_guardian_name: null, p_guardian_phone: null,
    p_guardian_relationship: null, p_consent_coc: true, p_consent_privacy: true, p_consent_photo: null,
    p_share_resume_with_sponsors: null, p_consent_indemnification: true,
    p_indemnification_path: `${USER}/sub-1.pdf`, p_stamped_at: '2027-01-02T04:30:00Z', p_email: 'Ada@Example.com',
    p_user_id: USER, ...overrides,
  };
  const names = Object.keys(args);
  const sql = `select public.reg_submit_application(${names.map((n, i) => `${n} => $${i + 1}`).join(', ')}) as r`;
  return (await db.query<{ r: SubmitResult }>(sql, names.map((n) => args[n]))).rows[0].r;
}

const row = async () => (await db.query<Record<string, unknown>>(
  'select status, submitted_at, submission_id, email, consent_indemnification, indemnification_path from public.applications where user_id=$1',
  [USER])).rows[0];

beforeAll(async () => {
  await db.exec(`
    create role anon nologin; create role authenticated nologin; create role service_role nologin bypassrls;
    create schema auth; create schema storage;
    create table auth.users(id uuid primary key);
    create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('test.uid', true), '')::uuid $$;
    create function auth.jwt() returns jsonb language sql stable as $$ select jsonb_build_object('email', current_setting('test.email', true)) $$;
    create table storage.buckets(id text primary key, name text, public boolean, file_size_limit bigint, allowed_mime_types text[]);
    create table storage.objects(id uuid primary key default gen_random_uuid(), bucket_id text, name text);
    create function storage.foldername(name text) returns text[] language sql as $$ select string_to_array(name, '/') $$;
  `);
  await db.exec((await migration('20250101000001_initial_schema')).replace(/create extension[^;]*;/i, ''));
  await db.exec(await migration('20261031000000_indemnification_form'));
  await db.exec(await migration('20261111000000_other_links'));
  await db.exec(await migration('20261113000000_preferred_name'));
  await db.exec(`insert into auth.users values ('${USER}');
    grant all on all tables in schema public to authenticated, service_role;
    set role service_role;`);
}, 30000);
beforeEach(async () => { await db.exec('delete from public.applications;'); });
afterAll(async () => { await db.close(); });

describe('reg_submit_application with the indemnification form', () => {
  it('inserts the submitted row when no draft exists yet', async () => {
    const result = await submit();
    expect(result.ok).toBe(true);
    expect(await row()).toEqual({
      status: 'submitted', submitted_at: new Date('2027-01-02T04:30:00Z'), submission_id: 'sub-1',
      email: 'ada@example.com', consent_indemnification: true, indemnification_path: `${USER}/sub-1.pdf`,
    });
  });

  it('submits an existing draft in place', async () => {
    await db.exec(`insert into public.applications(user_id, email) values ('${USER}', 'ada@example.com')`);
    expect((await submit()).ok).toBe(true);
    expect(await row()).toMatchObject({ status: 'submitted', indemnification_path: `${USER}/sub-1.pdf` });
  });

  it('replays the original success and keeps the first path', async () => {
    const first = await submit();
    const sameKey = await submit({ p_indemnification_path: `${USER}/other.pdf`, p_stamped_at: '2027-01-03T00:00:00Z' });
    const newKey = await submit({ p_submission_id: 'sub-2', p_indemnification_path: `${USER}/sub-2.pdf` });
    expect(sameKey).toEqual(first);
    expect(newKey).toEqual(first);
    expect(await row()).toMatchObject({ submission_id: 'sub-1', indemnification_path: `${USER}/sub-1.pdf` });
  });

  it.each([
    { p_consent_indemnification: false },
    { p_indemnification_path: null },
    { p_indemnification_path: '22222222-2222-4222-8222-222222222222/sub-1.pdf' },
  ])('refuses to submit without an accepted form in the applicant folder: %j', async (overrides) => {
    expect(await submit(overrides)).toEqual({ error: 'indemnification_required' });
    expect(await row()).toBeUndefined();
  });

  it('stores extra links when given and leaves them null otherwise', async () => {
    expect((await submit()).ok).toBe(true);
    const links = async () => (await db.query<{ other_links: string[] | null }>(
      'select other_links from public.applications where user_id=$1', [USER])).rows[0].other_links;
    expect(await links()).toBeNull();

    await db.exec('delete from public.applications;');
    expect((await submit({ p_other_links: ['https://devpost.com/ada', 'https://ada.blog'] })).ok).toBe(true);
    expect(await links()).toEqual(['https://devpost.com/ada', 'https://ada.blog']);
  });

  it('refuses more than three extra links', async () => {
    await expect(submit({ p_other_links: ['https://a.io', 'https://b.io', 'https://c.io', 'https://d.io'] }))
      .rejects.toThrow(/other_links/);
  });

  it('stores a preferred name when given, over the draft, and null otherwise', async () => {
    const preferred = async () => (await db.query<{ preferred_name: string | null }>(
      'select preferred_name from public.applications where user_id=$1', [USER])).rows[0].preferred_name;
    expect((await submit()).ok).toBe(true);
    expect(await preferred()).toBeNull();

    await db.exec('delete from public.applications;');
    await db.exec(`insert into public.applications(user_id, email, preferred_name) values ('${USER}', 'ada@example.com', 'Old')`);
    expect((await submit({ p_preferred_name: 'Ada' })).ok).toBe(true);
    expect(await preferred()).toBe('Ada');
  });

  it('refuses a preferred name over 100 characters', async () => {
    await expect(submit({ p_preferred_name: 'a'.repeat(101) })).rejects.toThrow(/preferred_name/);
  });

  it('stops applicants writing the path themselves', async () => {
    await db.exec(`insert into public.applications(user_id, email) values ('${USER}', 'ada@example.com')`);
    await db.exec(`begin; set local role authenticated; select set_config('test.uid', '${USER}', true);`);
    try {
      await expect(db.query(`update public.applications set indemnification_path='${USER}/fake.pdf' where user_id='${USER}'`))
        .rejects.toThrow(/indemnification_path/);
    } finally {
      await db.exec('rollback;');
    }
  });
});
