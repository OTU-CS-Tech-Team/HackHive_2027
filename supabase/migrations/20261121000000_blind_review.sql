-- Blind Reviewer: two admins vote Yes/No on each scored applicant without
-- seeing who they are. 2 Yes places them in a seat pool (Ontario Tech, then
-- lower years, then everyone else, then the waitlist), 2 No rejects them, and
-- a 1-1 split waits for a third admin.
--
-- This only decides and places. Nothing here touches applications.decision or
-- sends email: the Decisions page (release waves) stages and releases them.
--
-- Admins read everything here through RLS. Votes, claims and outcomes are only
-- written by the security definer functions below; notes are inserted directly
-- (RLS checks the author). Seat targets live in the one review_settings row:
-- edit it in the SQL editor if the seat count changes.
--
-- Safe to run more than once, in a single transaction.

begin;

-- Applicant numbers ------------------------------------------------------------
-- What reviewers see instead of a name ("#0427"). Handed out when an
-- application is submitted (not on every draft autosave, which would burn
-- numbers), and only by the trigger, so hackers can't pick theirs.

alter table public.applications add column if not exists applicant_no integer;
-- An earlier draft of this migration made it an identity column.
alter table public.applications alter column applicant_no drop identity if exists;
create unique index if not exists applications_applicant_no_idx on public.applications (applicant_no);

create sequence if not exists public.applicant_no_seq as integer owned by public.applications.applicant_no;
select setval('public.applicant_no_seq', coalesce((select max(applicant_no) from public.applications), 0) + 1, false);

-- Number anyone already submitted, oldest first.
do $$
declare
  v_id uuid;
begin
  for v_id in
    select id from public.applications
    where status = 'submitted' and applicant_no is null
    order by submitted_at nulls last, id
  loop
    update public.applications set applicant_no = nextval('public.applicant_no_seq') where id = v_id;
  end loop;
end;
$$;

create or replace function public.assign_applicant_no()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  -- Nobody sets or changes it by hand.
  new.applicant_no := case when tg_op = 'UPDATE' then old.applicant_no end;
  if new.status = 'submitted' and new.applicant_no is null then
    new.applicant_no := nextval('public.applicant_no_seq');
  end if;
  return new;
end;
$$;

drop trigger if exists applications_assign_applicant_no on public.applications;
create trigger applications_assign_applicant_no
  before insert or update on public.applications
  for each row execute function public.assign_applicant_no();

-- Settings (a single row) ------------------------------------------------------
-- Seats per pool: 375 seats split 30% / 15% / the rest. Keep in step with the
-- Decisions page trackers.

create table if not exists public.review_settings (
  id smallint primary key default 1 check (id = 1),
  otu_seats int not null default 113 check (otu_seats >= 0),
  lower_years_seats int not null default 56 check (lower_years_seats >= 0),
  general_seats int not null default 206 check (general_seats >= 0)
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
  pool text check (pool in ('otu', 'lower_years', 'general')),
  waitlist_position int check (waitlist_position > 0),
  decided_at timestamptz not null default now(),
  constraint review_outcomes_pool_if_accepted check ((outcome = 'accepted') = (pool is not null)),
  constraint review_outcomes_place_if_waitlisted check ((outcome = 'waitlisted') = (waitlist_position is not null))
);

create index if not exists review_outcomes_pool_idx on public.review_outcomes (pool) where outcome = 'accepted';

-- Resume cache -----------------------------------------------------------------
-- The cleaned Experience/Projects sections per resume file, so the queue page
-- doesn't download and parse the PDF on every render. Server (service role) only.

create table if not exists public.review_resume_cache (
  resume_path text primary key,
  version int not null,
  result jsonb not null,
  created_at timestamptz not null default now()
);

-- Row Level Security -----------------------------------------------------------

alter table public.review_settings enable row level security;
alter table public.review_votes enable row level security;
alter table public.review_claims enable row level security;
alter table public.review_notes enable row level security;
alter table public.review_outcomes enable row level security;
alter table public.review_resume_cache enable row level security; -- no policies: service role only

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

revoke all on public.review_settings, public.review_votes, public.review_claims, public.review_notes, public.review_outcomes, public.review_resume_cache from anon;
revoke all on public.review_resume_cache from authenticated;
revoke insert, update, delete on public.review_settings, public.review_votes, public.review_claims, public.review_outcomes from authenticated;
revoke update, delete on public.review_notes from authenticated;
grant select on public.review_settings, public.review_votes, public.review_claims, public.review_notes, public.review_outcomes to authenticated;
grant insert on public.review_notes to authenticated;

-- Pool rules -------------------------------------------------------------------
-- Ontario Tech by the saved school (the picker saves "Ontario Tech University";
-- the rest are what people type under "Other", as in src/lib/schools.ts).
-- Lower years: year_of_study "1" or "2".

create or replace function public.review_is_otu(p_university text)
returns boolean
language sql
immutable
set search_path = ''
as $$
  select coalesce(regexp_replace(lower(p_university), '[^a-z]', '', 'g') in (
    'ontariotechuniversity', 'ontariotech', 'ontariotechu', 'otu', 'uoit', 'universityofontarioinstituteoftechnology'
  ), false);
$$;

create or replace function public.review_is_lower_year(p_year text)
returns boolean
language sql
immutable
set search_path = ''
as $$
  select coalesce(btrim(p_year) in ('1', '2'), false);
$$;

-- review_pool_counts -----------------------------------------------------------
-- Seats taken per pool. Counts review placements, plus anyone accepted by hand
-- (on the Applicants or Decisions page) without a review placement, so manual
-- accepts use up seats too. Those are slotted in by the same rule (Ontario Tech,
-- then lower years, then everyone else), oldest submission first; once every
-- pool they fit is full they count towards everyone else, even past its target.

create or replace function public.review_pool_counts()
returns table (pool text, filled int, target int)
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_settings public.review_settings%rowtype;
  v_otu int;
  v_lower int;
  v_general int;
  v_app record;
begin
  if not coalesce(public.is_admin(), false) then
    raise exception 'Admins only' using errcode = '42501';
  end if;
  select * into v_settings from public.review_settings where id = 1;

  select
    count(*) filter (where o.pool = 'otu'),
    count(*) filter (where o.pool = 'lower_years'),
    count(*) filter (where o.pool = 'general')
  into v_otu, v_lower, v_general
  from public.review_outcomes o where o.outcome = 'accepted';

  for v_app in
    select a.university, a.year_of_study
    from public.applications a
    where a.decision = 'accepted'
      and not exists (select 1 from public.review_outcomes o where o.application_id = a.id and o.outcome = 'accepted')
    order by a.submitted_at nulls last, a.id
  loop
    if public.review_is_otu(v_app.university) and v_otu < v_settings.otu_seats then
      v_otu := v_otu + 1;
    elsif public.review_is_lower_year(v_app.year_of_study) and v_lower < v_settings.lower_years_seats then
      v_lower := v_lower + 1;
    else
      v_general := v_general + 1;
    end if;
  end loop;

  return query values
    ('otu'::text, v_otu, v_settings.otu_seats),
    ('lower_years'::text, v_lower, v_settings.lower_years_seats),
    ('general'::text, v_general, v_settings.general_seats);
end;
$$;

-- claim_next_review ------------------------------------------------------------
-- Your next applicant in a tier. The same one again if you already have one
-- open there (so refreshing never skips anyone); otherwise someone scored, in
-- the tier, with no outcome or decision, that isn't you, that you haven't voted
-- on or skipped, and that nobody else has open. People who already have a vote
-- come first, then it's random. No row = nothing left you can review.

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
    and a.user_id is distinct from v_uid
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
      and a.user_id is distinct from v_uid
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
-- 2 Yes = accepted into a pool (or waitlisted when every pool they fit is
-- full), 2 No = rejected, otherwise they wait for another vote. Returns what
-- happened: skipped | pending | accepted | waitlisted | rejected, or
-- not_claimed / already_voted / decided / own_application when it couldn't count.

drop function if exists public.cast_review_vote(uuid, text, boolean, boolean);

create or replace function public.cast_review_vote(p_application_id uuid, p_vote text)
returns table (result text, pool text, waitlist_position int)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := (select auth.uid());
  v_app public.applications%rowtype;
  v_owner uuid;
  v_yes int;
  v_no int;
  v_counts record;
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
  perform 1 from public.review_settings where id = 1 for update;
  if not found then
    raise exception 'review_settings is missing its row';
  end if;

  select * into v_app from public.applications a where a.id = p_application_id;
  if not found
     or v_app.decision is not null
     or exists (select 1 from public.review_outcomes o where o.application_id = p_application_id) then
    delete from public.review_claims c where c.application_id = p_application_id and c.admin_id = v_uid;
    return query select 'decided'::text, null::text, null::int;
    return;
  end if;
  if v_app.user_id = v_uid then
    delete from public.review_claims c where c.application_id = p_application_id;
    return query select 'own_application'::text, null::text, null::int;
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

  select
    max(c.filled) filter (where c.pool = 'otu') as otu,
    max(c.target) filter (where c.pool = 'otu') as otu_target,
    max(c.filled) filter (where c.pool = 'lower_years') as lower_years,
    max(c.target) filter (where c.pool = 'lower_years') as lower_years_target,
    max(c.filled) filter (where c.pool = 'general') as general,
    max(c.target) filter (where c.pool = 'general') as general_target
  into v_counts
  from public.review_pool_counts() c;

  if public.review_is_otu(v_app.university) and v_counts.otu < v_counts.otu_target then
    v_pool := 'otu';
  elsif public.review_is_lower_year(v_app.year_of_study) and v_counts.lower_years < v_counts.lower_years_target then
    v_pool := 'lower_years';
  elsif v_counts.general < v_counts.general_target then
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
-- Undo an outcome so the applicant goes back in the queue: clears the outcome
-- and the Yes/No votes (freeing the pool seat). "I know this person" skips and
-- notes stay. Refused once a decision has been set or staged for them, so
-- nobody who's been (or is about to be) emailed disappears from the results.

create or replace function public.reopen_review(p_application_id uuid)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_staged boolean := false;
begin
  if (select auth.uid()) is null or not public.is_admin() then
    raise exception 'Admins only' using errcode = '42501';
  end if;
  -- Same lock as voting, so a seat isn't freed halfway through a placement.
  perform 1 from public.review_settings where id = 1 for update;

  if exists (select 1 from public.applications a where a.id = p_application_id and a.decision is not null) then
    return false;
  end if;
  -- staged_decisions comes with the Decisions page, which may not be set up yet.
  if to_regclass('public.staged_decisions') is not null then
    execute 'select exists (select 1 from public.staged_decisions where application_id = $1)' into v_staged using p_application_id;
    if v_staged then
      return false;
    end if;
  end if;

  delete from public.review_outcomes o where o.application_id = p_application_id;
  if not found then
    return false;
  end if;
  delete from public.review_votes v where v.application_id = p_application_id and v.vote in ('yes', 'no');
  delete from public.review_claims c where c.application_id = p_application_id;
  return true;
end;
$$;

drop function if exists public.mark_review_released(uuid[]);

revoke all on function public.review_pool_counts() from public, anon;
revoke all on function public.claim_next_review(text) from public, anon;
revoke all on function public.cast_review_vote(uuid, text) from public, anon;
revoke all on function public.reopen_review(uuid) from public, anon;
grant execute on function public.review_pool_counts() to authenticated;
grant execute on function public.claim_next_review(text) to authenticated;
grant execute on function public.cast_review_vote(uuid, text) to authenticated;
grant execute on function public.reopen_review(uuid) to authenticated;

commit;
