-- HackHive 2027 initial schema: admins, profiles, emergency info, schedule,
-- sponsors, speakers/judges, points shop, storage buckets.
-- Public content (events, sponsors, speakers, shop) is readable by anyone;
-- only admins write it. Make yourself an admin from the SQL editor:
--   insert into admin_users (user_id) select id from auth.users where email = 'you@example.com';

create or replace function public.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = pg_catalog.now();
  return new;
end;
$$;

-- ── Admins ──────────────────────────────────────────────────────────────────

create table public.admin_users (
  user_id uuid primary key references auth.users on delete cascade,
  created_at timestamptz not null default now()
);

alter table public.admin_users enable row level security;

-- Lets the app check "am I an admin?"; adding admins is SQL-editor only.
create policy "admins_read_own_row" on public.admin_users
  for select to authenticated using (user_id = (select auth.uid()));

-- security definer so policies can call it without tripping admin_users RLS.
create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (select 1 from public.admin_users where user_id = auth.uid());
$$;

revoke all on function public.is_admin() from public;
grant execute on function public.is_admin() to anon, authenticated;

-- ── Profiles ────────────────────────────────────────────────────────────────

create table public.profiles (
  id uuid primary key references auth.users on delete cascade,
  email text,
  full_name text,
  avatar_url text,
  school text,
  linkedin_url text,
  github_url text,
  instagram_url text,
  looking_for_team boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.profiles enable row level security;

-- Hackers who opt into the teammate finder are visible to other signed-in
-- hackers (including their email); everyone else only sees their own row.
create policy "profiles_read" on public.profiles
  for select to authenticated
  using (id = (select auth.uid()) or looking_for_team or (select public.is_admin()));

create policy "profiles_update_own" on public.profiles
  for update to authenticated
  using (id = (select auth.uid()) or (select public.is_admin()))
  with check (id = (select auth.uid()) or (select public.is_admin()));

create trigger profiles_set_updated_at
  before update on public.profiles
  for each row execute function public.set_updated_at();

-- Every new auth user gets a profile. GitHub sends 'user_name', Google sends
-- 'full_name'/'name'; both send 'avatar_url'. Email signups send nothing, so
-- fall back to the email local part.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  meta jsonb := coalesce(new.raw_user_meta_data, '{}'::jsonb);
begin
  insert into public.profiles (id, email, full_name, avatar_url, github_url)
  values (
    new.id,
    new.email,
    coalesce(
      nullif(meta->>'full_name', ''),
      nullif(meta->>'name', ''),
      nullif(meta->>'user_name', ''),
      split_part(coalesce(new.email, ''), '@', 1)
    ),
    nullif(meta->>'avatar_url', ''),
    case
      when new.raw_app_meta_data->>'provider' = 'github' and meta->>'user_name' <> ''
      then 'https://github.com/' || (meta->>'user_name')
    end
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ── Emergency info ──────────────────────────────────────────────────────────
-- Separate table so it never rides along with a profile query.
-- Readable only by the hacker and admins (shown when an admin scans their QR).

create table public.emergency_info (
  user_id uuid primary key references public.profiles on delete cascade,
  contact_name text not null,
  contact_phone text not null,
  relationship text,
  medical_notes text, -- allergies, conditions, medication
  updated_at timestamptz not null default now()
);

alter table public.emergency_info enable row level security;

create policy "emergency_read" on public.emergency_info
  for select to authenticated
  using (user_id = (select auth.uid()) or (select public.is_admin()));

create policy "emergency_insert_own" on public.emergency_info
  for insert to authenticated with check (user_id = (select auth.uid()));

create policy "emergency_update_own" on public.emergency_info
  for update to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

create policy "emergency_delete_own" on public.emergency_info
  for delete to authenticated using (user_id = (select auth.uid()));

create trigger emergency_info_set_updated_at
  before update on public.emergency_info
  for each row execute function public.set_updated_at();

-- ── Schedule ────────────────────────────────────────────────────────────────
-- category drives the colour coding on the schedule page.

create type public.event_category as enum ('hackhive', 'workshop', 'fun', 'food', 'ceremony');

create table public.events (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  description text,
  category public.event_category not null,
  location text,
  host text, -- e.g. the sponsor running a workshop
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (ends_at > starts_at)
);

create index events_starts_at_idx on public.events (starts_at);

-- ── Sponsors ────────────────────────────────────────────────────────────────

create type public.sponsor_tier as enum ('gold', 'silver', 'bronze');

create table public.sponsors (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  tier public.sponsor_tier not null,
  logo_url text,
  website_url text,
  sort_order int not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ── Speakers & judges ───────────────────────────────────────────────────────

create type public.speaker_role as enum ('speaker', 'judge');

create table public.speakers_judges (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  role public.speaker_role not null,
  title text,   -- job title
  company text,
  bio text,
  photo_url text,
  linkedin_url text,
  sort_order int not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ── Points shop ─────────────────────────────────────────────────────────────

create table public.shop_items (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  description text,
  image_url text,
  cost int not null check (cost > 0),
  stock int check (stock >= 0), -- null = unlimited
  active boolean not null default true,
  sort_order int not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Same read-by-anyone / write-by-admins rules for all public content tables.
do $$
declare
  t text;
begin
  foreach t in array array['events', 'sponsors', 'speakers_judges', 'shop_items'] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('create policy "%s_public_read" on public.%I for select to anon, authenticated using (true)', t, t);
    execute format('create policy "%s_admin_insert" on public.%I for insert to authenticated with check ((select public.is_admin()))', t, t);
    execute format('create policy "%s_admin_update" on public.%I for update to authenticated using ((select public.is_admin())) with check ((select public.is_admin()))', t, t);
    execute format('create policy "%s_admin_delete" on public.%I for delete to authenticated using ((select public.is_admin()))', t, t);
    execute format('create trigger %s_set_updated_at before update on public.%I for each row execute function public.set_updated_at()', t, t);
  end loop;
end;
$$;

-- Points are a ledger: earning is a positive row, redeeming a negative one.
-- Rows are never edited; fix mistakes with a reversing row.
create table public.point_transactions (
  id bigint generated always as identity primary key,
  user_id uuid not null references public.profiles on delete cascade,
  amount int not null check (amount <> 0),
  reason text not null,
  shop_item_id uuid references public.shop_items,
  created_by uuid references auth.users default auth.uid(),
  created_at timestamptz not null default now()
);

create index point_transactions_user_id_idx on public.point_transactions (user_id);

alter table public.point_transactions enable row level security;

create policy "points_read" on public.point_transactions
  for select to authenticated
  using (user_id = (select auth.uid()) or (select public.is_admin()));

-- Only admins (help desk / event check-in) award or redeem points.
create policy "points_admin_insert" on public.point_transactions
  for insert to authenticated with check ((select public.is_admin()));

-- Redemptions charge the item's cost (whatever amount was sent), use up stock,
-- and can't take a balance below zero.
create or replace function public.apply_point_transaction()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  item public.shop_items;
  balance int;
begin
  -- Lock the hacker's profile so two simultaneous scans can't spend the same points.
  perform 1 from public.profiles where id = new.user_id for update;

  if new.shop_item_id is not null then
    select * into item from public.shop_items where id = new.shop_item_id for update;
    if not found or not item.active then
      raise exception 'That item is not available';
    end if;
    if item.stock is not null then
      if item.stock < 1 then
        raise exception '% is out of stock', item.name;
      end if;
      update public.shop_items set stock = stock - 1 where id = item.id;
    end if;
    new.amount := -item.cost;
  end if;

  select coalesce(sum(amount), 0) into balance
  from public.point_transactions where user_id = new.user_id;

  if balance + new.amount < 0 then
    raise exception 'Not enough points: has %, needs %', balance, -new.amount;
  end if;

  return new;
end;
$$;

create trigger point_transactions_apply
  before insert on public.point_transactions
  for each row execute function public.apply_point_transaction();

-- Hackers with no transactions have no row; treat missing as 0.
create view public.point_balances with (security_invoker = true) as
  select user_id, sum(amount)::int as balance
  from public.point_transactions
  group by user_id;

-- ── API grants ──────────────────────────────────────────────────────────────
-- RLS above decides which rows; these just make the tables reachable.

grant select on public.events, public.sponsors, public.speakers_judges, public.shop_items to anon;
grant select, insert, update, delete on
  public.events, public.sponsors, public.speakers_judges, public.shop_items,
  public.profiles, public.emergency_info
  to authenticated;
grant select on public.admin_users, public.point_balances to authenticated;
grant select, insert on public.point_transactions to authenticated;

-- Schedule changes (room moves, time shifts) push live to open dashboards.
alter publication supabase_realtime add table public.events;

-- ── Storage ─────────────────────────────────────────────────────────────────
-- avatars: each hacker writes only avatars/<their user id>/…
-- media:   sponsor logos, speaker photos, archive screenshots; admins write.

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values
  ('avatars', 'avatars', true, 2097152, array['image/jpeg', 'image/png', 'image/webp']),
  ('media', 'media', true, 10485760, array['image/jpeg', 'image/png', 'image/webp', 'image/svg+xml'])
on conflict (id) do nothing;

create policy "avatars_public_read" on storage.objects
  for select to public using (bucket_id = 'avatars');

create policy "avatars_insert_own" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'avatars' and (storage.foldername(name))[1] = (select auth.uid())::text);

create policy "avatars_update_own" on storage.objects
  for update to authenticated
  using (bucket_id = 'avatars' and (storage.foldername(name))[1] = (select auth.uid())::text)
  with check (bucket_id = 'avatars' and (storage.foldername(name))[1] = (select auth.uid())::text);

create policy "avatars_delete_own" on storage.objects
  for delete to authenticated
  using (bucket_id = 'avatars' and (storage.foldername(name))[1] = (select auth.uid())::text);

create policy "media_public_read" on storage.objects
  for select to public using (bucket_id = 'media');

create policy "media_admin_insert" on storage.objects
  for insert to authenticated with check (bucket_id = 'media' and (select public.is_admin()));

create policy "media_admin_update" on storage.objects
  for update to authenticated
  using (bucket_id = 'media' and (select public.is_admin()))
  with check (bucket_id = 'media' and (select public.is_admin()));

create policy "media_admin_delete" on storage.objects
  for delete to authenticated using (bucket_id = 'media' and (select public.is_admin()));
