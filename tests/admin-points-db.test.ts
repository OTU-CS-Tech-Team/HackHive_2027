import { PGlite } from '@electric-sql/pglite';
import { readFile } from 'node:fs/promises';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest';

// Exercise the actual migration in isolated PostgreSQL, never the shared project.
const db = new PGlite();

beforeAll(async () => {
  await db.exec(`
    create role anon nologin; create role authenticated nologin;
    create function public.is_admin() returns boolean language sql stable as $$
      select coalesce(current_setting('test.admin',true),'false')::boolean;
    $$;
    create function public.uid() returns uuid language sql stable as $$
      select nullif(current_setting('test.uid',true),'')::uuid;
    $$;
    create table public.point_transactions(id bigint generated always as identity primary key, user_id uuid not null, amount int not null);
    alter table public.point_transactions enable row level security;
    create policy points_read on public.point_transactions for select to authenticated
      using (user_id = public.uid() or public.is_admin());
    grant select on public.point_transactions to authenticated;
    grant usage on schema public to anon, authenticated;
  `);
  await db.exec(await readFile('supabase/migrations/20261117000000_admin_points_total.sql', 'utf8'));
}, 30000);
beforeEach(async () => { await db.exec('begin;'); });
// set local role ends with the transaction; rollback also clears an aborted one.
afterEach(async () => { await db.exec('rollback;'); });
afterAll(async () => { await db.close(); });

const total = async () => (await db.query<{ total: string }>('select public.admin_points_total()::text as total')).rows[0].total;
const as = (role: string, admin: boolean, uid = '') =>
  db.exec(`set local role ${role}; select set_config('test.admin','${admin}',true), set_config('test.uid','${uid}',true);`);

describe('admin_points_total', () => {
  it('is 0 before anyone has points', async () => {
    await as('authenticated', true);
    expect(await total()).toBe('0');
  });

  it('sums every hacker, past the 1000-row API cap', async () => {
    await db.exec(`insert into public.point_transactions(user_id, amount)
      select gen_random_uuid(), 5 from generate_series(1, 1500);
      insert into public.point_transactions(user_id, amount) values (gen_random_uuid(), -20);`);
    await as('authenticated', true);
    expect(await total()).toBe('7480');
  });

  it('refuses signed-in hackers instead of returning their own total', async () => {
    await as('authenticated', false, '11111111-1111-1111-1111-111111111111');
    await expect(total()).rejects.toThrow(/Admins only/);
  });

  it('is not callable signed out', async () => {
    await as('anon', false);
    await expect(total()).rejects.toThrow(/permission denied/);
  });
});
