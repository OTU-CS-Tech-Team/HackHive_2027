import { PGlite } from '@electric-sql/pglite';
import { readFile } from 'node:fs/promises';
import { beforeAll, afterAll, beforeEach, afterEach, describe, it, expect } from 'vitest';

// An isolated PostgreSQL engine: these tests never connect to shared Supabase.
const db = new PGlite();
const user = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`;
const setup = `
  create role anon nologin;
  create role authenticated nologin;
  create role service_role nologin bypassrls;
  create schema auth;
  create table auth.users(id uuid primary key);
  create function auth.uid() returns uuid language sql stable as $$
    select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid;
  $$;
  create table public.profiles (
    id uuid primary key references auth.users on delete cascade, email text, full_name text, school text,
    avatar_url text, github_url text, linkedin_url text, instagram_url text,
    looking_for_team boolean not null default false
  );
  create table public.applications(user_id uuid primary key,decision text);
  create table public.admin_users(user_id uuid primary key);
  create function public.is_admin() returns boolean language sql stable security definer set search_path='' as $$
    select exists(select 1 from public.admin_users where user_id=auth.uid());
  $$;
  create function public.is_accepted(uid uuid) returns boolean language sql stable security definer set search_path='' as $$
    select exists(select 1 from public.applications where user_id=uid and decision='accepted');
  $$;
  create function public.has_hub_access() returns boolean language sql stable set search_path='' as $$
    select public.is_admin() or public.is_accepted(auth.uid());
  $$;
  grant usage on schema auth,public to authenticated,anon,service_role;
  grant select,update on public.profiles to authenticated;
  alter table public.profiles enable row level security;
  create policy profiles_read on public.profiles for select to authenticated using (
    id=(select auth.uid()) or (looking_for_team and (select public.has_hub_access()) and public.is_accepted(id)) or (select public.is_admin())
  );
  create policy profiles_update on public.profiles for update to authenticated
    using(id=(select auth.uid())) with check(id=(select auth.uid()));
`;

async function asUser(n: number) {
  await db.exec(`reset role; set local role authenticated; select set_config('request.jwt.claim.sub','${user(n)}',true);`);
}
async function asOwner() { await db.exec('reset role;'); }
async function scalar<T = unknown>(sql: string): Promise<T> { return (await db.query<{ value: T }>(sql)).rows[0].value; }
async function rejects(sql: string, message?: RegExp) {
  await db.exec('savepoint expected_failure;');
  try { await expect(db.query(sql)).rejects.toThrow(message); }
  finally { await db.exec('rollback to savepoint expected_failure; release savepoint expected_failure;'); }
}
async function createTeam(n = 1, capacity = 4) {
  await asUser(n);
  return scalar<string>(`insert into public.recruiting_teams(owner_id,name,pitch,capacity) values('${user(n)}','Team ${n}','An accessible campus project',${capacity}) returning id as value;`);
}
async function apply(team: string, n: number) {
  await asUser(n);
  await db.query(`select public.request_team_join('${team}','I can contribute frontend skills and would love to build this.');`);
  return scalar<string>(`select id as value from public.team_join_requests where team_id='${team}' and applicant_id='${user(n)}';`);
}

beforeAll(async () => {
  await db.exec(setup);
  await db.exec(await readFile('supabase/migrations/20261023003437_teammate_slack_profile.sql', 'utf8'));
  await db.exec(await readFile('supabase/migrations/20261024231211_teammate_discovery_and_recruiting.sql', 'utf8'));
  for (let n = 1; n <= 8; n++) {
    await db.query(`insert into auth.users(id) values($1);`, [user(n)]);
    await db.query(`insert into public.profiles(id,email,full_name,school,slack_url,looking_for_team) values($1,$2,$3,'Ontario Tech','https://demo.slack.com/team/U123ABC',true);`, [user(n), `private-${n}@example.test`, `Hacker ${n}`]);
    await db.query(`insert into public.applications values($1,$2);`, [user(n), n === 8 ? 'rejected' : 'accepted']);
  }
}, 30000);
beforeEach(async () => { await db.exec('begin;'); });
afterEach(async () => { await db.exec('reset role; rollback;'); });
afterAll(async () => { await db.close(); });

describe('teammate recruiting database authorization and invariants', () => {
  it('enables RLS on every new table and denies anonymous access', async () => {
    expect(await scalar<number>(`select count(*)::int as value from pg_class where relname in ('teammate_bookmarks','recruiting_teams','team_memberships','team_join_requests') and relrowsecurity;`)).toBe(4);
    expect(await scalar<boolean>(`select has_function_privilege('authenticated','team_internal.member_joined()','execute') as value;`)).toBe(false);
    await db.exec('set local role anon;');
    await rejects('select * from public.recruiting_teams;', /permission denied/);
    await rejects('select public.confirm_teammate_availability(true,false);', /permission denied/);
  });

  it('keeps saved/contacted state private and preserves independent updates', async () => {
    await asUser(1);
    await db.query(`select public.set_teammate_bookmark('${user(2)}',true,null);`);
    await db.query(`select public.set_teammate_bookmark('${user(2)}',null,true);`);
    await db.query(`select public.set_teammate_bookmark('${user(2)}',false,null);`);
    expect((await db.query('select saved,reached_out from public.teammate_bookmarks;')).rows).toEqual([{ saved: false, reached_out: true }]);
    await asUser(3);
    expect(await scalar<number>('select count(*)::int as value from public.teammate_bookmarks;')).toBe(0);
    await rejects(`insert into public.teammate_bookmarks(owner_id,target_id) values('${user(1)}','${user(2)}');`, /row-level security/);
  });

  it('creates the owner membership and automatically hides the owner listing', async () => {
    const team = await createTeam();
    expect(await scalar<number>(`select count(*)::int as value from public.team_memberships where team_id='${team}';`)).toBe(1);
    expect((await db.query(`select looking_for_team,team_found from public.profiles where id='${user(1)}';`)).rows).toEqual([{ looking_for_team: false, team_found: true }]);
    await rejects(`insert into public.recruiting_teams(owner_id,name,pitch) values('${user(2)}','Spoofed team','Trying to assign someone else');`);
    await asUser(8);
    await rejects(`insert into public.recruiting_teams(owner_id,name,pitch) values('${user(8)}','Rejected user','Trying without accepted access');`, /row-level security/);
  });

  it('requires an applicant request and owner approval; requests stay private', async () => {
    const team = await createTeam();
    const request = await apply(team, 2);
    await rejects(`update public.team_join_requests set status='accepted' where id='${request}';`, /row-level security/);
    await rejects(`insert into public.team_memberships(team_id,user_id,display_name) values('${team}','${user(2)}','Spoof');`);
    await asUser(3);
    expect(await scalar<number>('select count(*)::int as value from public.team_join_requests;')).toBe(0);
    await rejects(`select public.review_team_join('${request}',true);`, /no longer pending|owner/);
    await asUser(1);
    await db.query(`select public.review_team_join('${request}',true);`);
    expect(await scalar<number>(`select count(*)::int as value from public.team_memberships where team_id='${team}';`)).toBe(2);
    await asOwner();
    expect((await db.query(`select looking_for_team,team_found from public.profiles where id='${user(2)}';`)).rows).toEqual([{ looking_for_team: false, team_found: true }]);
  });

  it('does not overfill a team and rolls back a failed approval', async () => {
    const team = await createTeam(1, 2);
    const a = await apply(team, 2), b = await apply(team, 3);
    await asUser(1);
    await db.query(`select public.review_team_join('${a}',true);`);
    await rejects(`select public.review_team_join('${b}',true);`, /full/);
    expect(await scalar<string>(`select status as value from public.team_join_requests where id='${b}';`)).toBe('pending');
    expect(await scalar<number>(`select count(*)::int as value from public.team_memberships where team_id='${team}';`)).toBe(2);
  });

  it('allows one team per hacker and withdraws their other pending requests', async () => {
    const first = await createTeam(1), second = await createTeam(3);
    const a = await apply(first, 2), b = await apply(second, 2);
    await asUser(1); await db.query(`select public.review_team_join('${a}',true);`);
    await asUser(3);
    expect(await scalar<string>(`select status as value from public.team_join_requests where id='${b}';`)).toBe('withdrawn');
    await rejects(`select public.review_team_join('${b}',true);`, /no longer pending/);
    await asUser(2); await rejects(`select public.request_team_join('${second}','Trying to join another team');`, /already have a team/);
  });

  it('supports withdrawal and a new introduction without duplicate pending requests', async () => {
    const team = await createTeam();
    const request = await apply(team, 2);
    await rejects(`select public.request_team_join('${team}','A duplicate introduction');`, /pending request|row-level security/);
    await db.query(`update public.team_join_requests set status='withdrawn' where id='${request}';`);
    await db.query(`select public.request_team_join('${team}','A new introduction with updated interests');`);
    expect(await scalar<string>(`select status as value from public.team_join_requests where id='${request}';`)).toBe('pending');
    expect(await scalar<string>(`select message as value from public.team_join_requests where id='${request}';`)).toContain('new introduction');
  });

  it('rejects approvals if the applicant no longer has accepted-hacker access', async () => {
    const team = await createTeam(); const request = await apply(team, 2);
    await asOwner(); await db.query(`update public.applications set decision='rejected' where user_id='${user(2)}';`);
    await asUser(1); await rejects(`select public.review_team_join('${request}',true);`, /no longer has accepted/);
    expect(await scalar<string>(`select status as value from public.team_join_requests where id='${request}';`)).toBe('pending');
  });

  it('leaves listings hidden after leaving and requires an explicit reconfirmation', async () => {
    const team = await createTeam(); const request = await apply(team, 2);
    await asUser(1); await db.query(`select public.review_team_join('${request}',true);`);
    expect(await scalar<number>(`with gone as (delete from public.team_memberships where user_id='${user(1)}' returning id) select count(*)::int as value from gone;`)).toBe(0);
    await asUser(2); await db.query(`delete from public.team_memberships where team_id='${team}' and user_id='${user(2)}';`);
    expect(await scalar<boolean>(`select looking_for_team as value from public.profiles where id='${user(2)}';`)).toBe(false);
    await db.query('select public.confirm_teammate_availability(true,false);');
    expect((await db.query(`select looking_for_team,team_found,team_confirmed_at is not null as confirmed from public.profiles where id='${user(2)}';`)).rows).toEqual([{ looking_for_team: true, team_found: false, confirmed: true }]);
  });

  it('does not relist current members, even with a direct profile update', async () => {
    await createTeam(); await db.query(`update public.profiles set looking_for_team=true,team_found=false where id='${user(1)}';`);
    expect(await scalar<boolean>(`select looking_for_team as value from public.profiles where id='${user(1)}';`)).toBe(false);
    await rejects('select public.confirm_teammate_availability(true,false);', /Leave your current team/);
  });

  it('locks ownership and prevents request reassignment', async () => {
    const team = await createTeam(); const other = await createTeam(3); const request = await apply(team, 2);
    await rejects(`update public.team_join_requests set team_id='${other}' where id='${request}';`, /reassigned/);
    await asUser(1); await rejects(`update public.recruiting_teams set owner_id='${user(2)}' where id='${team}';`, /ownership/);
    await db.query(`select public.review_team_join('${request}',true);`);
    await rejects(`update public.recruiting_teams set capacity=1 where id='${team}';`, /smaller|check constraint/);
  });

  it('allows hiding an external team listing and validates tags and profile bounds', async () => {
    await asUser(2); await db.query('select public.confirm_teammate_availability(false,true);');
    expect((await db.query(`select looking_for_team,team_found from public.profiles where id='${user(2)}';`)).rows).toEqual([{ looking_for_team: false, team_found: true }]);
    await rejects(`update public.profiles set team_skills=array['${'x'.repeat(33)}'] where id='${user(2)}';`, /check constraint/);
    await rejects(`update public.profiles set team_bio='${'x'.repeat(281)}' where id='${user(2)}';`, /check constraint/);
  });
});
