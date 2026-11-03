-- Schedule categories (each is a column + colour on the schedule) become a table
-- admins edit from /admin, instead of a fixed enum. color is a palette key from
-- COLORS in src/lib/schedule.ts.

create table public.event_categories (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  color text not null,
  sort_order int not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.event_categories enable row level security;
create policy "event_categories_public_read" on public.event_categories for select to anon, authenticated using (true);
create policy "event_categories_admin_insert" on public.event_categories for insert to authenticated with check ((select public.is_admin()));
create policy "event_categories_admin_update" on public.event_categories for update to authenticated using ((select public.is_admin())) with check ((select public.is_admin()));
create policy "event_categories_admin_delete" on public.event_categories for delete to authenticated using ((select public.is_admin()));
create trigger event_categories_set_updated_at before update on public.event_categories for each row execute function public.set_updated_at();

grant select on public.event_categories to anon;
grant select, insert, update, delete on public.event_categories to authenticated;

-- Renames and recolours push live to open schedules, like event changes.
alter publication supabase_realtime add table public.event_categories;

-- The old enum values, same labels and colours as before.
insert into public.event_categories (name, color, sort_order) values
  ('HackHive', 'amber', 0),
  ('Sponsor workshops', 'sky', 1),
  ('Fun events', 'fuchsia', 2),
  ('Food', 'emerald', 3),
  ('Ceremonies', 'violet', 4);

-- restrict: a category can't be deleted while events still use it.
alter table public.events add column category_id uuid references public.event_categories (id) on delete restrict;

update public.events e set category_id = c.id
from public.event_categories c
where c.name = case e.category
  when 'hackhive' then 'HackHive'
  when 'workshop' then 'Sponsor workshops'
  when 'fun' then 'Fun events'
  when 'food' then 'Food'
  when 'ceremony' then 'Ceremonies'
end;

-- The old enum column stays (no longer required) so the site still running the
-- previous code keeps rendering until this deploy is live. Nothing new reads it.
alter table public.events alter column category_id set not null, alter column category drop not null;
create index events_category_id_idx on public.events (category_id);
