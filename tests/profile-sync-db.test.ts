import { PGlite } from '@electric-sql/pglite';
import { readFile } from 'node:fs/promises';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

const db = new PGlite();
const id = (n: number) => `00000000-0000-4000-8000-00000000000${n}`;
const profile = async (n: number) =>
  (await db.query<{ full_name: string | null; avatar_url: string | null }>('select full_name, avatar_url from public.profiles where id=$1', [id(n)])).rows[0];
const setMeta = (n: number, meta: object) => db.query('update auth.users set raw_user_meta_data=$2 where id=$1', [id(n), JSON.stringify(meta)]);

beforeAll(async () => {
  await db.exec(`
    create schema auth;
    create table auth.users(id uuid primary key, raw_user_meta_data jsonb);
    create table public.profiles(id uuid primary key, full_name text, avatar_url text);
    create table public.applications(user_id uuid primary key, first_name text, last_name text, preferred_name text);
  `);
  // Accounts that exist before the migration runs.
  for (let n = 1; n <= 6; n++) await db.query("insert into auth.users values ($1, '{}')", [id(n)]);
  await db.exec(`
    insert into public.profiles values
      ('${id(1)}', 'tabishghouri3', null),
      ('${id(2)}', 'uploader', 'https://storage/avatars/2/avatar.webp'),
      ('${id(3)}', 'fresh', null), ('${id(4)}', 'fresh', null), ('${id(5)}', 'fresh', null), ('${id(6)}', 'fresh', null);
    insert into public.applications values ('${id(1)}', 'Tabish', 'Ghouri', null);
    update auth.users set raw_user_meta_data = '{"avatar_url":"https://google/1.jpg"}' where id in ('${id(1)}', '${id(2)}');
  `);
  await db.exec(await readFile('supabase/migrations/20261116000000_profile_photo_and_name.sql', 'utf8'));
}, 30000);
afterAll(async () => { await db.close(); });

describe('backfill', () => {
  it('names profiles from their application and fills missing Google photos', async () => {
    expect(await profile(1)).toEqual({ full_name: 'Tabish Ghouri', avatar_url: 'https://google/1.jpg' });
  });

  it('keeps a photo the hacker uploaded', async () => {
    expect((await profile(2)).avatar_url).toBe('https://storage/avatars/2/avatar.webp');
  });
});

describe('application name sync', () => {
  it('prefers the preferred name', async () => {
    await db.query("insert into public.applications values ($1, 'Tabish', 'Ghouri', 'Tabby')", [id(3)]);
    expect((await profile(3)).full_name).toBe('Tabby Ghouri');
  });

  it('falls back to the first name when the preferred name is blank', async () => {
    await db.query("update public.applications set preferred_name = '  ' where user_id=$1", [id(3)]);
    expect((await profile(3)).full_name).toBe('Tabish Ghouri');
  });

  it('leaves the name alone until a first or preferred name exists', async () => {
    await db.query("insert into public.applications values ($1, null, 'Ghouri', null)", [id(4)]);
    expect((await profile(4)).full_name).toBe('fresh');
  });
});

describe('Google photo sync', () => {
  it('fills a missing photo from the picture field', async () => {
    await setMeta(5, { picture: 'https://google/5.jpg' });
    expect((await profile(5)).avatar_url).toBe('https://google/5.jpg');
  });

  it('never replaces an existing photo', async () => {
    await setMeta(2, { avatar_url: 'https://google/2-new.jpg' });
    expect((await profile(2)).avatar_url).toBe('https://storage/avatars/2/avatar.webp');
  });

  it('ignores metadata without a photo', async () => {
    await setMeta(6, { name: 'No Photo' });
    expect((await profile(6)).avatar_url).toBeNull();
  });
});
