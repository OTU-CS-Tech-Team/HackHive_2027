import { PGlite } from '@electric-sql/pglite';
import { readFile } from 'node:fs/promises';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest';

// Exercise the actual migrations in isolated PostgreSQL, never the shared project.
const db = new PGlite();
const migration = (name: string) => readFile(`supabase/migrations/${name}.sql`, 'utf8');
async function category(legacy: string) {
  return (await db.query<{ id: string }>('select id from public.event_categories where legacy_category=$1', [legacy])).rows[0].id;
}
async function reject(sql: string, message: RegExp) {
  await db.exec('savepoint rejected_write;');
  try { await expect(db.query(sql)).rejects.toThrow(message); }
  finally { await db.exec('rollback to savepoint rejected_write; release savepoint rejected_write;'); }
}

beforeAll(async () => {
  await db.exec(`
    create role anon nologin; create role authenticated nologin;
    create function public.is_admin() returns boolean language sql stable as $$
      select coalesce(current_setting('test.admin',true),'false')::boolean;
    $$;
    create function public.set_updated_at() returns trigger language plpgsql as $$
      begin new.updated_at=now(); return new; end;
    $$;
    create type public.event_category as enum ('hackhive','workshop','fun','food','ceremony');
    create table public.events(id uuid primary key default gen_random_uuid(), title text not null, category public.event_category not null);
    alter table public.events enable row level security;
    create policy events_read on public.events for select to anon,authenticated using (true);
    create policy events_insert on public.events for insert to authenticated with check (public.is_admin());
    create policy events_update on public.events for update to authenticated using (public.is_admin()) with check (public.is_admin());
    grant select on public.events to anon;
    grant select,insert,update,delete on public.events to authenticated;
    create publication supabase_realtime;
    insert into public.events(title,category) values ('Existing dinner','food');
  `);
  await db.exec(await migration('20261023000000_event_categories'));
  await db.exec(await migration('20261025000000_schedule_colours'));
  // Model an already-applied migration with preview edits and nullable enum rows.
  await db.exec(`update public.event_categories set name='Meals' where name='Food';
    insert into public.events(title,category_id) select 'New editor row',id from public.event_categories where name='Sponsor workshops';`);
  // Also exercise a single prepared statement, matching the SQL editor path.
  await db.query(await migration('20261026062455_schedule_category_compatibility'));
}, 30000);
beforeEach(async () => {
  await db.exec(`begin; set local role authenticated; select set_config('test.admin','true',true);`);
});
afterEach(async () => { await db.exec('reset role; rollback;'); });
afterAll(async () => { await db.close(); });

describe('schedule category compatibility', () => {
  it('repairs existing nullable enum rows and preserves a renamed built-in alias', async () => {
    expect((await db.query('select title,category from public.events order by title')).rows).toEqual([
      { title: 'Existing dinner', category: 'food' }, { title: 'New editor row', category: 'workshop' },
    ]);
    expect((await db.query("select name from public.event_categories where legacy_category='food'")).rows).toEqual([{ name: 'Meals' }]);
  });

  it('accepts old-editor inserts and category changes without category_id', async () => {
    await db.exec(`insert into public.events(title,category) values ('Old editor','food');`);
    expect((await db.query("select category_id from public.events where title='Old editor'")).rows[0]).toEqual({ category_id: await category('food') });
    await db.exec("update public.events set category='workshop' where title='Old editor';");
    expect((await db.query("select category_id,category from public.events where title='Old editor'")).rows[0]).toEqual({ category_id: await category('workshop'), category: 'workshop' });
  });

  it('accepts new-editor inserts and changes while maintaining a readable legacy enum', async () => {
    const food = await category('food'), ceremony = await category('ceremony');
    await db.exec(`insert into public.events(title,category_id) values ('New editor','${food}');
      update public.events set category_id='${ceremony}' where title='New editor';`);
    expect((await db.query("select category from public.events where title='New editor'")).rows).toEqual([{ category: 'ceremony' }]);
  });

  it('uses the explicit new ID when both representations are supplied', async () => {
    const ceremony = await category('ceremony'), workshop = await category('workshop');
    await db.exec(`insert into public.events(title,category,category_id) values ('Both','food','${ceremony}');
      update public.events set category='fun',category_id='${workshop}' where title='Both';`);
    expect((await db.query("select category from public.events where title='Both'")).rows).toEqual([{ category: 'workshop' }]);
  });

  it('keeps custom categories exact for new clients and safe for old readers and title edits', async () => {
    const custom = (await db.query<{ id: string }>("insert into public.event_categories(name,color) values ('Networking','teal') returning id")).rows[0].id;
    await db.exec(`insert into public.events(title,category_id) values ('Custom event','${custom}');
      update public.events set title='Edited custom event',category='hackhive' where title='Custom event';`);
    expect((await db.query("select category_id,category from public.events where title='Edited custom event'")).rows).toEqual([{ category_id: custom, category: 'hackhive' }]);
    await db.exec('set local role anon;');
    expect((await db.query("select category from public.events where title='Edited custom event'")).rows).toEqual([{ category: 'hackhive' }]);
  });

  it('retains legacy aliases when admins rename categories after deployment', async () => {
    await db.exec("update public.event_categories set name='Sponsor sessions' where legacy_category='workshop';");
    await db.exec("insert into public.events(title,category) values ('Still works','workshop');");
    expect((await db.query("select c.name from public.events e join public.event_categories c on c.id=e.category_id where e.title='Still works'")).rows).toEqual([{ name: 'Sponsor sessions' }]);
  });

  it('rejects unavailable categories instead of creating invalid or unsynchronized events', async () => {
    await reject("insert into public.events(title,category_id) values ('Bad','00000000-0000-4000-8000-000000000001')", /category no longer exists/);
    await reject("insert into public.events(title) values ('Missing')", /category no longer exists/);
    await db.exec("delete from public.event_categories where legacy_category='fun';");
    await reject("insert into public.events(title,category) values ('Deleted','fun')", /category no longer exists/);
  });

  it('preserves RLS and uses an invoker trigger without granting callable privileges', async () => {
    expect((await db.query("select has_function_privilege('authenticated','public.sync_event_category()','execute') as allowed")).rows).toEqual([{ allowed: false }]);
    expect((await db.query("select prosecdef from pg_proc where oid='public.sync_event_category()'::regprocedure")).rows).toEqual([{ prosecdef: false }]);
    await db.exec("select set_config('test.admin','false',true);");
    await reject("insert into public.events(title,category) values ('Non-admin','food')", /row-level security/);
    await reject("insert into public.event_categories(name,color) values ('Non-admin','teal')", /row-level security/);
    expect((await db.query('select count(*)::int as count from public.events where category is null or category_id is null')).rows).toEqual([{ count: 0 }]);
  });
});
