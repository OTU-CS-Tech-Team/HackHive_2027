-- Hackers request hardware, toiletries or other items; admins accept or reject.
-- Reviewed requests stay in the table as the history.

create table public.item_requests (
  id uuid primary key default gen_random_uuid(),
  -- Queue position: first come, first served. "generated always" means the
  -- database hands out the next number and nobody can insert their own.
  queue_number bigint generated always as identity unique,
  user_id uuid not null references public.profiles on delete cascade,
  -- [{ "category": "hardware" | "toiletries" | "other", "name": "...", "quantity": 1 }, ...]
  -- The server action validates each entry; the database just insists on a non-empty list.
  items jsonb not null check (jsonb_typeof(items) = 'array' and jsonb_array_length(items) > 0),
  team_members text[] not null default '{}', -- names, so admins can see the whole team
  details text, -- special needs, anything else the hacker wants admins to know
  status text not null default 'pending' check (status in ('pending', 'accepted', 'rejected')),
  reviewed_by uuid references public.profiles on delete set null,
  reviewed_at timestamptz,
  admin_note text, -- why it was accepted/rejected
  created_at timestamptz not null default now()
);

create index item_requests_user_id_idx on public.item_requests (user_id);

alter table public.item_requests enable row level security;

create policy "item_requests_read" on public.item_requests
  for select to authenticated
  using (user_id = (select auth.uid()) or (select public.is_admin()));

-- New requests must be the hacker's own, pending and unreviewed, so nobody can approve themselves.
create policy "item_requests_insert_own" on public.item_requests
  for insert to authenticated
  with check (
    user_id = (select auth.uid())
    and status = 'pending'
    and reviewed_by is null
    and reviewed_at is null
    and admin_note is null
  );

-- Accept/reject. Deleting reviewed requests is allowed in 20261022000000_item_requests_admin_delete.sql.
create policy "item_requests_admin_update" on public.item_requests
  for update to authenticated
  using ((select public.is_admin()))
  with check ((select public.is_admin()));

-- RLS above decides which rows; this just makes the table reachable.
grant select, insert, update on public.item_requests to authenticated;
