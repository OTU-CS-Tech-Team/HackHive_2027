import { PGlite } from '@electric-sql/pglite';
import { readFile } from 'node:fs/promises';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';

const db = new PGlite();
const migration = (name: string) => readFile(`supabase/migrations/${name}.sql`, 'utf8');
const USER = '11111111-1111-4111-8111-111111111111';

type SubmitResult = { ok?: boolean; error?: string };

async function submit(overrides: Record<string, unknown> = {}): Promise<SubmitResult> {
  const args: Record<string, unknown> = {
    p_submission_id: 'sub-1', p_first_name: 'Ada', p_last_name: 'Lovelace', p_phone: '4165550100', p_age: 21,
    p_pronouns: null, p_city: 'Toronto', p_country: 'Canada', p_university: 'University of Toronto', p_program: 'CS',
    p_year_of_study: '3', p_grad_date: null, p_hackathons_count: null, p_linkedin_url: null, p_github_url: null,
    p_portfolio_url: null, p_resume_path: `${USER}/resume.pdf`, p_q_proud: 'a', p_q_hack: 'b', p_q_anything_else: null,
    p_team_status: 'solo', p_teammate_emails: null, p_dietary: null, p_accessibility: null, p_tshirt_size: 'M',
    p_needs_travel_help: null, p_gender: null, p_ethnicity: null, p_guardian_name: null, p_guardian_phone: null,
    p_guardian_relationship: null, p_consent_coc: true, p_consent_privacy: true, p_consent_photo: null,
    p_share_resume_with_sponsors: null, p_consent_indemnification: true, p_consent_esignature: true,
    p_consent_mlh_coc: true, p_consent_mlh_share: true, p_consent_mlh_emails: false,
    p_indemnification_path: `${USER}/sub-1.pdf`, p_stamped_at: '2027-01-02T04:30:00Z', p_email: 'ada@example.com',
    p_user_id: USER, ...overrides,
  };
  const names = Object.keys(args);
  const sql = `select public.reg_submit_application(${names.map((n, i) => `${n} => $${i + 1}`).join(', ')}) as r`;
  return (await db.query<{ r: SubmitResult }>(sql, names.map((n) => args[n]))).rows[0].r;
}

const saved = async () => (await db.query<{ level_of_study: string | null; year_of_study: string | null }>(
  'select level_of_study, year_of_study from public.applications where user_id=$1', [USER])).rows[0];

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
  await db.exec(await migration('20261113000000_preferred_name_esignature'));
  await db.exec(await migration('20261125000000_mlh_consents'));
  await db.exec(await migration('20261127000000_level_of_study'));
  await db.exec(`insert into auth.users values ('${USER}');
    grant all on all tables in schema public to authenticated, service_role;
    set role service_role;`);
}, 30000);
beforeEach(async () => { await db.exec('delete from public.applications;'); });
afterAll(async () => { await db.close(); });

describe('reg_submit_application with level of study', () => {
  it('leaves exactly one version of the function', async () => {
    const { rows } = await db.query<{ n: number }>(
      "select count(*)::int as n from pg_proc where proname = 'reg_submit_application'");
    expect(rows[0].n).toBe(1);
  });

  it('stores the level of study with the year', async () => {
    expect((await submit({ p_level_of_study: 'undergrad' })).ok).toBe(true);
    expect(await saved()).toEqual({ level_of_study: 'undergrad', year_of_study: '3' });
  });

  it('stores a level without a year', async () => {
    expect((await submit({ p_level_of_study: 'graduate', p_year_of_study: null })).ok).toBe(true);
    expect(await saved()).toEqual({ level_of_study: 'graduate', year_of_study: null });
  });

  it('overwrites a draft level when submitting', async () => {
    await db.exec(`insert into public.applications(user_id, email, level_of_study, year_of_study)
      values ('${USER}', 'ada@example.com', 'undergrad', '1')`);
    expect((await submit({ p_level_of_study: 'bootcamp', p_year_of_study: null })).ok).toBe(true);
    expect(await saved()).toEqual({ level_of_study: 'bootcamp', year_of_study: null });
  });

  it('still accepts a call without the new parameter', async () => {
    expect((await submit()).ok).toBe(true);
    expect(await saved()).toEqual({ level_of_study: null, year_of_study: '3' });
  });

  it('refuses a level over 50 characters', async () => {
    await expect(submit({ p_level_of_study: 'a'.repeat(51) })).rejects.toThrow(/level_of_study/);
  });

  it('still requires the MLH consents', async () => {
    expect(await submit({ p_level_of_study: 'secondary', p_consent_mlh_share: false })).toEqual({ error: 'mlh_required' });
  });
});
