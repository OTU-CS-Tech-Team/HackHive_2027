-- Item requests: hackers ask for hardware, toiletries or other items, and admins
-- accept or reject them first come, first served. Reviewed requests stay in the
-- table as the history.
--
-- Everything for item requests lives in this one file, and it's safe to run more
-- than once: on a fresh database it creates everything, and on one that already
-- has some of it, it fills in what's missing and updates the rest. It runs in a
-- single transaction, so if any part fails nothing is changed.

begin;

-- The table ------------------------------------------------------------------

create table if not exists public.item_requests (
  id uuid primary key default gen_random_uuid(),
  -- Ticket number: first come, first served. "generated always" means the
  -- database hands out the next number and nobody can insert their own.
  queue_number bigint generated always as identity unique,
  user_id uuid not null references public.profiles on delete cascade,
  -- [{ "category": "hardware" | "toiletries" | "other", "name": "...", "quantity": 1 }, ...]
  -- Checked entry by entry by item_requests_items_valid below.
  items jsonb not null,
  team_members text[] not null default '{}', -- names, so admins can see the whole team
  details text, -- special needs, anything else the hacker wants admins to know
  status text not null default 'pending' check (status in ('pending', 'accepted', 'rejected')),
  reviewed_by uuid references public.profiles on delete set null,
  reviewed_at timestamptz,
  admin_note text, -- why it was accepted/rejected
  created_at timestamptz not null default now()
);

create index if not exists item_requests_user_id_idx on public.item_requests (user_id);

-- Valid items ----------------------------------------------------------------
-- The server action checks requests too, but anyone can call the API directly, so
-- the database checks every entry: { "category": "hardware" | "toiletries" |
-- "other", "name": 1-100 characters, "quantity": a whole number of at least 1 },
-- with the quantities adding up to at most 5 (MAX_ITEMS in src/lib/itemRequests.ts).

create or replace function public.item_requests_items_valid(items jsonb)
returns boolean
language plpgsql
immutable
set search_path = ''
as $$
declare
  item jsonb;
  quantity numeric;
  total numeric := 0;
begin
  if items is null or jsonb_typeof(items) <> 'array' or jsonb_array_length(items) = 0 then
    return false;
  end if;

  for item in select value from jsonb_array_elements(items) loop
    -- Also rejects null, strings, numbers and nested arrays.
    if jsonb_typeof(item) <> 'object' then
      return false;
    end if;

    if jsonb_typeof(item -> 'category') is distinct from 'string'
      or item ->> 'category' not in ('hardware', 'toiletries', 'other') then
      return false;
    end if;

    if jsonb_typeof(item -> 'name') is distinct from 'string'
      or length(btrim(item ->> 'name')) not between 1 and 100 then
      return false;
    end if;

    -- Checked as a number before converting, so "abc" or true can't raise an error.
    if jsonb_typeof(item -> 'quantity') is distinct from 'number' then
      return false;
    end if;
    quantity := (item ->> 'quantity')::numeric;
    if quantity < 1 or quantity <> trunc(quantity) then
      return false;
    end if;

    total := total + quantity;
  end loop;

  return total <= 5;
end;
$$;

-- Added as "not valid" and then validated, so if any bad rows already exist this
-- stops with an error instead of silently changing them. To find them:
--   select id, items from public.item_requests
--   where not public.item_requests_items_valid(items);
alter table public.item_requests drop constraint if exists item_requests_items_valid;
alter table public.item_requests
  add constraint item_requests_items_valid check (public.item_requests_items_valid(items)) not valid;
alter table public.item_requests validate constraint item_requests_items_valid;

-- Who can do what ------------------------------------------------------------

alter table public.item_requests enable row level security;

drop policy if exists "item_requests_read" on public.item_requests;
create policy "item_requests_read" on public.item_requests
  for select to authenticated
  using (user_id = (select auth.uid()) or (select public.is_admin()));

-- New requests must be the hacker's own, pending and unreviewed, so nobody can approve themselves.
drop policy if exists "item_requests_insert_own" on public.item_requests;
create policy "item_requests_insert_own" on public.item_requests
  for insert to authenticated
  with check (
    user_id = (select auth.uid())
    and status = 'pending'
    and reviewed_by is null
    and reviewed_at is null
    and admin_note is null
  );

-- Accept/reject.
drop policy if exists "item_requests_admin_update" on public.item_requests;
create policy "item_requests_admin_update" on public.item_requests
  for update to authenticated
  using ((select public.is_admin()))
  with check ((select public.is_admin()));

-- Admins can delete requests that have already been accepted or rejected. Pending
-- requests can't be deleted, so nobody can skip the queue by clearing it.
drop policy if exists "item_requests_admin_delete" on public.item_requests;
create policy "item_requests_admin_delete" on public.item_requests
  for delete to authenticated
  using ((select public.is_admin()) and status <> 'pending');

-- RLS above decides which rows; this just makes the table reachable.
grant select, insert, update, delete on public.item_requests to authenticated;

-- Up to three pending requests per hacker ------------------------------------
-- MAX_PENDING_REQUESTS in src/lib/itemRequests.ts. A unique index can't count to
-- three, so a trigger checks instead.

-- An earlier version allowed only one, using this index; drop it if a database has it.
drop index if exists public.item_requests_one_pending_per_user;

create or replace function public.item_requests_check_pending_limit()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.status <> 'pending' then
    return new;
  end if;

  -- Two requests sent at the same moment would both see a count of two, so take a
  -- per-hacker lock until this insert commits.
  perform pg_advisory_xact_lock(hashtext('item_requests:' || new.user_id::text));

  if (
    select count(*) from public.item_requests
    where user_id = new.user_id and status = 'pending'
  ) >= 3 then
    -- HHQ01 is our own code; the server action turns it into a friendly message.
    raise exception 'You already have 3 requests in the queue.' using errcode = 'HHQ01';
  end if;

  return new;
end;
$$;

drop trigger if exists item_requests_pending_limit on public.item_requests;
create trigger item_requests_pending_limit
  before insert on public.item_requests
  for each row execute function public.item_requests_check_pending_limit();

-- Place in the queue ---------------------------------------------------------
-- Where each of the caller's pending requests is in line: 1 is next up. Hackers
-- can only read their own rows, so this runs as the owner to count everyone
-- else's pending requests ahead of theirs, and returns only the caller's rows.

create or replace function public.my_item_request_positions()
returns table (id uuid, queue_position bigint)
language sql
security definer
stable
set search_path = ''
as $$
  select mine.id, (
    select count(*) from public.item_requests ahead
    where ahead.status = 'pending' and ahead.queue_number <= mine.queue_number
  )
  from public.item_requests mine
  where mine.user_id = (select auth.uid()) and mine.status = 'pending';
$$;

revoke execute on function public.my_item_request_positions() from public, anon;
grant execute on function public.my_item_request_positions() to authenticated;

commit;
