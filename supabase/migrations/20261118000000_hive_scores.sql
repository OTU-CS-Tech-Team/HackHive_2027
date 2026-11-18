-- The Hive Mind: AI grading of submitted applications and the tier it suggests
-- (Larva, Worker Bee, Queen Bee) so applicants are compared with their peers.
-- Every score and tier is a suggestion; admins can override the tier, and every
-- override is logged in hive_tier_changes.
--
-- Kept out of public.applications on purpose: hackers can write their own
-- application row, and none of this should be readable or writable by them.
-- Admins read and override through RLS; scoring writes with the service role.
--
-- Safe to run more than once, in a single transaction.

begin;

-- Scores ---------------------------------------------------------------------

create table if not exists public.hive_scores (
  application_id uuid primary key references public.applications on delete cascade,
  -- pending: queued or in progress. scored: done. failed: see error, retry later.
  status text not null default 'pending' check (status in ('pending', 'scored', 'failed')),

  -- The AI's four checks on the "most proud of" answer.
  built_it boolean,
  shipped boolean,
  impact boolean,
  beyond_tutorial boolean,
  -- 1 + checks passed, worked out in code (src/lib/hive/tier.ts), not by the AI.
  experience smallint check (experience between 1 and 5),
  -- AI ratings, 1-5: the "hacked something" answer, and specificity/clarity of both.
  creativity smallint check (creativity between 1 and 5),
  quality smallint check (quality between 1 and 5),
  rationale text, -- the AI's short explanation, shown to admins
  flags text[] not null default '{}',

  suggested_tier text check (suggested_tier in ('larva', 'worker', 'queen')),
  tier_override text check (tier_override in ('larva', 'worker', 'queen')),
  override_reason text,
  overridden_by uuid references public.profiles on delete set null,
  overridden_at timestamptz,
  -- What admins filter and count by.
  tier text generated always as (coalesce(tier_override, suggested_tier)) stored,

  model text,
  prompt_version int,
  attempts int not null default 0,
  error text,
  scored_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint hive_scores_scored_complete check (
    status <> 'scored' or (
      built_it is not null and shipped is not null and impact is not null and beyond_tutorial is not null
      and experience is not null and creativity is not null and quality is not null
      and suggested_tier is not null and scored_at is not null
    )
  ),
  constraint hive_scores_override_explained check (
    tier_override is null or (nullif(btrim(override_reason), '') is not null and overridden_by is not null)
  )
);

create index if not exists hive_scores_tier_idx on public.hive_scores (tier);
create index if not exists hive_scores_status_idx on public.hive_scores (status);

alter table public.hive_scores enable row level security;

drop policy if exists "hive_scores_admin_read" on public.hive_scores;
create policy "hive_scores_admin_read" on public.hive_scores
  for select to authenticated using ((select public.is_admin()));

drop policy if exists "hive_scores_admin_update" on public.hive_scores;
create policy "hive_scores_admin_update" on public.hive_scores
  for update to authenticated
  using ((select public.is_admin())) with check ((select public.is_admin()));

revoke all on public.hive_scores from anon;

-- Override log ---------------------------------------------------------------
-- One row per tier change by an admin, written by the trigger below so it can't
-- be skipped. Read by the post-decision bias check.

create table if not exists public.hive_tier_changes (
  id bigint generated always as identity primary key,
  application_id uuid not null references public.applications on delete cascade,
  from_tier text,
  to_tier text,
  reason text,
  changed_by uuid references public.profiles on delete set null,
  changed_at timestamptz not null default now()
);

create index if not exists hive_tier_changes_application_idx on public.hive_tier_changes (application_id);

alter table public.hive_tier_changes enable row level security;

drop policy if exists "hive_tier_changes_admin_read" on public.hive_tier_changes;
create policy "hive_tier_changes_admin_read" on public.hive_tier_changes
  for select to authenticated using ((select public.is_admin()));

revoke all on public.hive_tier_changes from anon;
revoke insert, update, delete on public.hive_tier_changes from authenticated;

-- security definer: admins get no insert grant on the log, so only this writes it.
create or replace function public.log_hive_tier_change()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.tier_override is distinct from old.tier_override then
    insert into public.hive_tier_changes (application_id, from_tier, to_tier, reason, changed_by)
    values (
      new.application_id,
      coalesce(old.tier_override, old.suggested_tier),
      coalesce(new.tier_override, new.suggested_tier),
      new.override_reason,
      new.overridden_by
    );
  end if;
  return new;
end;
$$;

revoke all on function public.log_hive_tier_change() from public;

drop trigger if exists hive_scores_log_tier_change on public.hive_scores;
create trigger hive_scores_log_tier_change
  after update of tier_override on public.hive_scores
  for each row execute function public.log_hive_tier_change();

commit;
