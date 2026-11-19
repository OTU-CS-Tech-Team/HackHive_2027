import { PGlite } from '@electric-sql/pglite';
import { readFile } from 'node:fs/promises';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

const db = new PGlite();
const id = (n: number) => `00000000-0000-4000-8000-00000000000${n}`;
const profile = async (n: number) =>
  (await db.query<{ full_name: string | null; avatar_url: string | null }>('select full_name, avatar_url from public.profiles where id=$1', [id(n)])).rows[0];
const apply = (n: number, first: string | null, last: string | null, preferred: string | null = null) =>
  db.query('insert into public.applications values ($1, $2, $3, $4)', [id(n), first, last, preferred]);

beforeAll(async () => {
  await db.exec(`
    create schema auth;
    create table auth.users(id uuid primary key, email text, raw_user_meta_data jsonb);
    create table public.profiles(id uuid primary key, full_name text, avatar_url text);
    create table public.applications(user_id uuid primary key, first_name text, last_name text, preferred_name text);
  `);
  // Accounts that exist before the migration runs, as handle_new_user left them.
  const accounts: [number, string, object, string | null][] = [
    [1, 'tabish@example.com', { avatar_url: 'https://google/1.jpg' }, 'tabish'],
    [2, 'two@example.com', {}, 'Custom Name'], // changed on the Profile tab
    [3, 'fresh@example.com', {}, 'fresh'],
    [4, 'four@example.com', {}, 'four'],
    [5, 'five@example.com', { name: 'Google Name' }, 'Google Name'],
    [6, 'six@example.com', {}, null],
  ];
  for (const [n, email, meta, name] of accounts) {
    await db.query('insert into auth.users values ($1, $2, $3)', [id(n), email, JSON.stringify(meta)]);
    await db.query('insert into public.profiles values ($1, $2, null)', [id(n), name]);
  }
  await apply(1, 'Tabish', 'Ghouri');
  await db.exec(await readFile('supabase/migrations/20261116000000_profile_photo_and_name.sql', 'utf8'));
}, 30000);
afterAll(async () => { await db.close(); });

describe('migration', () => {
  it('leaves existing profiles alone', async () => {
    expect(await profile(1)).toEqual({ full_name: 'tabish', avatar_url: null });
  });

  it('adds no trigger to auth.users', async () => {
    const { rows } = await db.query("select 1 from pg_trigger where tgrelid = 'auth.users'::regclass and not tgisinternal");
    expect(rows).toHaveLength(0);
  });
});

describe('application name sync', () => {
  it('replaces the email prefix, preferring the preferred name', async () => {
    await apply(3, 'Tabish', 'Ghouri', 'Tabby');
    expect((await profile(3)).full_name).toBe('Tabby Ghouri');
  });

  it('follows later edits, falling back to the first name when the preferred name is blank', async () => {
    await db.query("update public.applications set preferred_name = '  ' where user_id=$1", [id(3)]);
    expect((await profile(3)).full_name).toBe('Tabish Ghouri');
  });

  it('leaves the name alone until a first or preferred name exists', async () => {
    await apply(4, null, 'Ghouri');
    expect((await profile(4)).full_name).toBe('four');
  });

  it('replaces the name Google gave at sign-up', async () => {
    await apply(5, 'Ada', 'Lovelace');
    expect((await profile(5)).full_name).toBe('Ada Lovelace');
  });

  it('fills an empty name', async () => {
    await apply(6, 'Ada', 'Lovelace');
    expect((await profile(6)).full_name).toBe('Ada Lovelace');
  });

  it('keeps a name the hacker set on the Profile tab', async () => {
    await apply(2, 'Ada', 'Lovelace');
    await db.query("update public.applications set first_name = 'Augusta' where user_id=$1", [id(2)]);
    expect((await profile(2)).full_name).toBe('Custom Name');
  });
});
