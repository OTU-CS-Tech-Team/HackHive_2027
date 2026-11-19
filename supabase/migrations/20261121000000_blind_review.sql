-- Blind Reviewer: two admins vote Yes/No on each scored applicant without
-- seeing who they are. 2 Yes places them in a seat pool (OTU, then 1st/2nd
-- year, then General, then the waitlist), 2 No rejects them, and a 1-1 split
-- waits for a third admin. Nothing is emailed until an admin releases the
-- outcome from the Results page (that sets applications.decision).
--
-- Admins read everything here through RLS. Votes, claims and outcomes are only
-- written by the security definer functions below; notes are inserted directly
-- (RLS checks the author). Seat numbers live in the one review_settings row:
-- edit it in the SQL editor if the seat count changes.
--
-- Safe to run more than once, in a single transaction.

begin;

-- Applicant numbers ------------------------------------------------------------
-- What reviewers see instead of a name ("#0427"). Generated always, so hackers
-- (who can write their own draft row) can't pick theirs.

alter table public.applications add column if not exists applicant_no integer generated always as identity;
create unique index if not exists applications_applicant_no_idx on public.applications (applicant_no);

-- Settings (a single row) ------------------------------------------------------

create table if not exists public.review_settings (
  id smallint primary key default 1 check (id = 1),
  seats int not null default 375 check (seats > 0),
  -- Percent of seats. General gets whatever OTU and 1st/2nd year don't, so
  -- rounding never loses a seat; general_pct is kept for reference.
  otu_pct numeric not null default 30 check (otu_pct between 0 and 100),
  early_pct numeric not null default 15 check (early_pct between 0 and 100),
  general_pct numeric not null default 55 check (general_pct between 0 and 100),
  constraint review_settings_adds_up check (otu_pct + early_pct + general_pct = 100)
);

insert into public.review_settings (id) values (1) on conflict (id) do nothing;

-- Votes (also the audit log) ---------------------------------------------------

create table if not exists public.review_votes (
  application_id uuid not null references public.applications on delete cascade,
  admin_id uuid not null references public.profiles on delete cascade,
  -- skip = "I know this person": it hides them from you but isn't a vote.
  vote text not null check (vote in ('yes', 'no', 'skip')),
  created_at timestamptz not null default now(),
  primary key (application_id, admin_id)
);

create index if not exists review_votes_admin_idx on public.review_votes (admin_id);

-- Claims -----------------------------------------------------------------------
-- "This admin has this applicant open right now". One per applicant; after 15
-- minutes another admin can take it over.

create table if not exists public.review_claims (
  application_id uuid primary key references public.applications on delete cascade,
  admin_id uuid not null references public.profiles on delete cascade,
  tier text not null check (tier in ('larva', 'worker', 'queen')),
  claimed_at timestamptz not null default now()
);

create index if not exists review_claims_admin_idx on public.review_claims (admin_id, tier);

-- Notes ------------------------------------------------------------------------

create table if not exists public.review_notes (
  id bigint generated always as identity primary key,
  application_id uuid not null references public.applications on delete cascade,
  author_id uuid references public.profiles on delete set null,
  body text not null check (length(btrim(body)) between 1 and 2000),
  created_at timestamptz not null default now()
);

create index if not exists review_notes_application_idx on public.review_notes (application_id);

-- Outcomes ---------------------------------------------------------------------

create table if not exists public.review_outcomes (
  application_id uuid primary key references public.applications on delete cascade,
  outcome text not null check (outcome in ('accepted', 'waitlisted', 'rejected')),
  pool text check (pool in ('otu', 'early', 'general')),
  waitlist_position int check (waitlist_position > 0),
  decided_at timestamptz not null default now(),
  released_at timestamptz,
  released_by uuid references public.profiles on delete set null,
  constraint review_outcomes_pool_if_accepted check ((outcome = 'accepted') = (pool is not null)),
  constraint review_outcomes_place_if_waitlisted check ((outcome = 'waitlisted') = (waitlist_position is not null))
);

create index if not exists review_outcomes_pool_idx on public.review_outcomes (pool) where outcome = 'accepted';

-- Row Level Security -----------------------------------------------------------

alter table public.review_settings enable row level security;
alter table public.review_votes enable row level security;
alter table public.review_claims enable row level security;
alter table public.review_notes enable row level security;
alter table public.review_outcomes enable row level security;

drop policy if exists "review_settings_admin_read" on public.review_settings;
create policy "review_settings_admin_read" on public.review_settings
  for select to authenticated using ((select public.is_admin()));

drop policy if exists "review_votes_admin_read" on public.review_votes;
create policy "review_votes_admin_read" on public.review_votes
  for select to authenticated using ((select public.is_admin()));

drop policy if exists "review_claims_admin_read" on public.review_claims;
create policy "review_claims_admin_read" on public.review_claims
  for select to authenticated using ((select public.is_admin()));

drop policy if exists "review_outcomes_admin_read" on public.review_outcomes;
create policy "review_outcomes_admin_read" on public.review_outcomes
  for select to authenticated using ((select public.is_admin()));

drop policy if exists "review_notes_admin_read" on public.review_notes;
create policy "review_notes_admin_read" on public.review_notes
  for select to authenticated using ((select public.is_admin()));

drop policy if exists "review_notes_admin_insert" on public.review_notes;
create policy "review_notes_admin_insert" on public.review_notes
  for insert to authenticated
  with check ((select public.is_admin()) and author_id = (select auth.uid()));

revoke all on public.review_settings, public.review_votes, public.review_claims, public.review_notes, public.review_outcomes from anon;
revoke insert, update, delete on public.review_settings, public.review_votes, public.review_claims, public.review_outcomes from authenticated;
revoke update, delete on public.review_notes from authenticated;
grant select on public.review_settings, public.review_votes, public.review_claims, public.review_notes, public.review_outcomes to authenticated;
grant insert on public.review_notes to authenticated;

-- claim_next_review ------------------------------------------------------------
-- Your next applicant in a tier. The same one again if you already have one
-- open there (so refreshing never skips anyone); otherwise someone scored, in
-- the tier, with no outcome or decision, that you haven't voted on or skipped
-- and nobody else has open. People who already have a vote come first, then
-- it's random. No row = nothing left you can review.

create or replace function public.claim_next_review(p_tier text)
returns table (application_id uuid, applicant_no int)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := (select auth.uid());
  v_app uuid;
  v_try int;
begin
  if v_uid is null or not public.is_admin() then
    raise exception 'Admins only' using errcode = '42501';
  end if;
  if p_tier is null or p_tier not in ('larva', 'worker', 'queen') then
    raise exception 'Unknown tier %', p_tier using errcode = '22023';
  end if;

  -- 1. Already open for you in this tier.
  select c.application_id into v_app
  from public.review_claims c
  join public.hive_scores s on s.application_id = c.application_id
  join public.applications a on a.id = c.application_id
  where c.admin_id = v_uid and c.tier = p_tier
    and s.status = 'scored' and s.tier = p_tier
    and a.status = 'submitted' and a.decision is null
    and not exists (select 1 from public.review_outcomes o where o.application_id = c.application_id)
    and not exists (select 1 from public.review_votes v where v.application_id = c.application_id and v.admin_id = v_uid)
  order by c.claimed_at desc
  limit 1;

  if v_app is not null then
    update public.review_claims set claimed_at = now() where review_claims.application_id = v_app;
    return query select a.id, a.applicant_no from public.applications a where a.id = v_app;
    return;
  end if;

  -- Anything else you had open in this tier is stale (decided, moved tier...).
  delete from public.review_claims where admin_id = v_uid and tier = p_tier;

  -- 2. Pick someone new. skip locked: two admins asking at once get different people.
  for v_try in 1..5 loop
    select a.id into v_app
    from public.applications a
    join public.hive_scores s on s.application_id = a.id
    left join public.review_claims c on c.application_id = a.id
    where a.status = 'submitted' and a.decision is null
      and s.status = 'scored' and s.tier = p_tier
      and not exists (select 1 from public.review_outcomes o where o.application_id = a.id)
      and not exists (select 1 from public.review_votes v where v.application_id = a.id and v.admin_id = v_uid)
      and (c.application_id is null or c.claimed_at < now() - interval '15 minutes')
    order by
      exists (select 1 from public.review_votes v where v.application_id = a.id and v.vote <> 'skip') desc,
      random()
    limit 1
    for update of s skip locked;

    if v_app is null then
      return;
    end if;

    insert into public.review_claims as rc (application_id, admin_id, tier, claimed_at)
    values (v_app, v_uid, p_tier, now())
    on conflict on constraint review_claims_pkey do update
      set admin_id = excluded.admin_id, tier = excluded.tier, claimed_at = excluded.claimed_at
      where rc.claimed_at < now() - interval '15 minutes' or rc.admin_id = excluded.admin_id;

    if found then
      return query select a.id, a.applicant_no from public.applications a where a.id = v_app;
      return;
    end if;
    -- Someone else claimed them a moment ago: try again.
    v_app := null;
  end loop;
end;
$$;

-- cast_review_vote -------------------------------------------------------------
-- Records your vote on the applicant you have open, then decides if it can:
-- 2 Yes = accepted into a pool (or waitlisted when all three are full),
-- 2 No = rejected, otherwise they wait for another vote. Returns what happened:
-- skipped | pending | accepted | waitlisted | rejected, or not_claimed /
-- already_voted / decided when the vote couldn't count.
--
-- p_is_otu / p_is_early_year are worked out by the server from the application
-- (src/app/admin/review/actions.ts), so school matching stays in one place.

create or replace function public.cast_review_vote(
  p_application_id uuid,
  p_vote text,
  p_is_otu boolean default false,
  p_is_early_year boolean default false
)
returns table (result text, pool text, waitlist_position int)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := (select auth.uid());
  v_settings public.review_settings%rowtype;
  v_owner uuid;
  v_yes int;
  v_no int;
  v_otu_target int;
  v_early_target int;
  v_general_target int;
  v_otu int;
  v_early int;
  v_general int;
  v_pool text;
  v_position int;
begin
  if v_uid is null or not public.is_admin() then
    raise exception 'Admins only' using errcode = '42501';
  end if;
  if p_vote is null or p_vote not in ('yes', 'no', 'skip') then
    raise exception 'Unknown vote %', p_vote using errcode = '22023';
  end if;

  -- One vote at a time, everywhere: the 2-vote count and the pool counts below
  -- can't race, so two votes landing together never overfill a pool.
  select * into v_settings from public.review_settings where id = 1 for update;
  if not found then
    raise exception 'review_settings is missing its row';
  end if;

  if exists (select 1 from public.review_outcomes o where o.application_id = p_application_id) then
    return query select 'decided'::text, null::text, null::int;
    return;
  end if;

  -- Only the admin holding the claim can vote (an expired claim nobody took over still counts).
  select c.admin_id into v_owner from public.review_claims c where c.application_id = p_application_id;
  if v_owner is distinct from v_uid then
    return query select 'not_claimed'::text, null::text, null::int;
    return;
  end if;

  insert into public.review_votes (application_id, admin_id, vote)
  values (p_application_id, v_uid, p_vote)
  on conflict do nothing;
  if not found then
    delete from public.review_claims c where c.application_id = p_application_id;
    return query select 'already_voted'::text, null::text, null::int;
    return;
  end if;
  delete from public.review_claims c where c.application_id = p_application_id;

  if p_vote = 'skip' then
    return query select 'skipped'::text, null::text, null::int;
    return;
  end if;

  select count(*) filter (where v.vote = 'yes'), count(*) filter (where v.vote = 'no')
  into v_yes, v_no
  from public.review_votes v where v.application_id = p_application_id;

  if v_no >= 2 then
    insert into public.review_outcomes (application_id, outcome) values (p_application_id, 'rejected');
    return query select 'rejected'::text, null::text, null::int;
    return;
  end if;
  if v_yes < 2 then
    return query select 'pending'::text, null::text, null::int;
    return;
  end if;

  -- Keep in sync with poolTargets() in src/lib/review/pools.ts.
  v_otu_target := round(v_settings.seats * v_settings.otu_pct / 100.0);
  v_early_target := round(v_settings.seats * v_settings.early_pct / 100.0);
  v_general_target := greatest(v_settings.seats - v_otu_target - v_early_target, 0);

  select
    count(*) filter (where o.pool = 'otu'),
    count(*) filter (where o.pool = 'early'),
    count(*) filter (where o.pool = 'general')
  into v_otu, v_early, v_general
  from public.review_outcomes o where o.outcome = 'accepted';

  if p_is_otu and v_otu < v_otu_target then
    v_pool := 'otu';
  elsif p_is_early_year and v_early < v_early_target then
    v_pool := 'early';
  elsif v_general < v_general_target then
    v_pool := 'general';
  end if;

  if v_pool is not null then
    insert into public.review_outcomes (application_id, outcome, pool) values (p_application_id, 'accepted', v_pool);
    return query select 'accepted'::text, v_pool, null::int;
    return;
  end if;

  select coalesce(max(o.waitlist_position), 0) + 1 into v_position from public.review_outcomes o where o.outcome = 'waitlisted';
  insert into public.review_outcomes (application_id, outcome, waitlist_position) values (p_application_id, 'waitlisted', v_position);
  return query select 'waitlisted'::text, null::text, v_position;
end;
$$;

-- reopen_review ----------------------------------------------------------------
-- Undo an outcome that hasn't been released: clears it and its votes (which
-- frees the pool seat) so the applicant goes back in the queue. Notes stay.

create or replace function public.reopen_review(p_application_id uuid)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
begin
  if (select auth.uid()) is null or not public.is_admin() then
    raise exception 'Admins only' using errcode = '42501';
  end if;
  -- Same lock as voting, so a seat isn't freed halfway through a placement.
  perform 1 from public.review_settings where id = 1 for update;

  delete from public.review_outcomes o where o.application_id = p_application_id and o.released_at is null;
  if not found then
    return false;
  end if;
  delete from public.review_votes v where v.application_id = p_application_id;
  delete from public.review_claims c where c.application_id = p_application_id;
  return true;
end;
$$;

-- mark_review_released ---------------------------------------------------------
-- Called by the release action after it has set applications.decision (and
-- sent the email). Returns the ones it marked; already-released ones are skipped.

create or replace function public.mark_review_released(p_application_ids uuid[])
returns setof uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := (select auth.uid());
begin
  if v_uid is null or not public.is_admin() then
    raise exception 'Admins only' using errcode = '42501';
  end if;
  return query
    update public.review_outcomes o
    set released_at = now(), released_by = v_uid
    where o.application_id = any(p_application_ids) and o.released_at is null
    returning o.application_id;
end;
$$;

revoke all on function public.claim_next_review(text) from public, anon;
revoke all on function public.cast_review_vote(uuid, text, boolean, boolean) from public, anon;
revoke all on function public.reopen_review(uuid) from public, anon;
revoke all on function public.mark_review_released(uuid[]) from public, anon;
grant execute on function public.claim_next_review(text) to authenticated;
grant execute on function public.cast_review_vote(uuid, text, boolean, boolean) to authenticated;
grant execute on function public.reopen_review(uuid) to authenticated;
grant execute on function public.mark_review_released(uuid[]) to authenticated;

commit;
