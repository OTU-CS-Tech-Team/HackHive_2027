-- Hacker hub: scavenger hunt and hardware checkout lists (admins edit them
-- from /admin, hackers see them on /dashboard/user), plus admin access to
-- applications for the /admin stats and list.
-- Like the shop, claiming happens at the help desk: they scan your pass and
-- award points / hand over the hardware.

create table public.scavenger_items (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  clue text,
  points int not null default 0 check (points >= 0),
  sort_order int not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.hardware_items (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  description text,
  image_url text,
  stock int check (stock >= 0), -- null = unlimited
  sort_order int not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

do $$
declare
  t text;
begin
  foreach t in array array['scavenger_items', 'hardware_items'] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('create policy "%s_signed_in_read" on public.%I for select to authenticated using (true)', t, t);
    execute format('create policy "%s_admin_insert" on public.%I for insert to authenticated with check ((select public.is_admin()))', t, t);
    execute format('create policy "%s_admin_update" on public.%I for update to authenticated using ((select public.is_admin())) with check ((select public.is_admin()))', t, t);
    execute format('create policy "%s_admin_delete" on public.%I for delete to authenticated using ((select public.is_admin()))', t, t);
    execute format('create trigger %s_set_updated_at before update on public.%I for each row execute function public.set_updated_at()', t, t);
  end loop;
end;
$$;

grant select, insert, update, delete on public.scavenger_items, public.hardware_items to authenticated;

-- applications only let reg_admins read everything; let site admins too.
create policy "admin_users_select_all_applications" on public.applications
  for select to authenticated using ((select public.is_admin()));
