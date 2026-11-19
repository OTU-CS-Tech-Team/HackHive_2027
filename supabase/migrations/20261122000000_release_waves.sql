-- Decisions go out in waves instead of one email per click.
--
-- 1. staged_decisions: what an admin has decided but not sent. Kept out of
--    public.applications on purpose: applicants can read their own row, and a
--    staged decision must stay invisible to them until it's released.
-- 2. release_wave() moves staged decisions onto applications.decision in one
--    transaction (that's the moment the dashboard unlocks for accepts) and logs
--    one wave_emails row per applicant. Rejections are held back unless the
--    admin says this is the final wave.
-- 3. The server then sends the emails in small batches, claiming rows with
--    claim_wave_emails() so two admins pressing "send" can't email anyone twice.
--    A claim older than 2 minutes is stale (the request was killed) and can be
--    taken over.
--
-- Applicants decided before this migration simply count as released (no wave).
-- Safe to run more than once, in a single transaction.

begin;

-- Staged decisions -------------------------------------------------------------

create table if not exists public.staged_decisions (
  application_id uuid primary key references public.applications on delete cascade,
  decision text not null check (decision in ('accepted', 'waitlisted', 'rejected')),
  staged_by uuid default auth.uid() references public.profiles on delete set null,
  staged_at timestamptz not null default now()
);

alter table public.staged_decisions enable row level security;

drop policy if exists "staged_decisions_admin_read" on public.staged_decisions;
create policy "staged_decisions_admin_read" on public.staged_decisions
  for select to authenticated using ((select public.is_admin()));

drop policy if exists "staged_decisions_admin_insert" on public.staged_decisions;
-- staged_by is always whoever staged it.
create policy "staged_decisions_admin_insert" on public.staged_decisions
  for insert to authenticated
  with check ((select public.is_admin()) and staged_by is not distinct from (select auth.uid()));

drop policy if exists "staged_decisions_admin_update" on public.staged_decisions;
create policy "staged_decisions_admin_update" on public.staged_decisions
  for update to authenticated
  using ((select public.is_admin()))
  with check ((select public.is_admin()) and staged_by is not distinct from (select auth.uid()));

drop policy if exists "staged_decisions_admin_delete" on public.staged_decisions;
create policy "staged_decisions_admin_delete" on public.staged_decisions
  for delete to authenticated using ((select public.is_admin()));

revoke all on public.staged_decisions from anon;

-- Waves ------------------------------------------------------------------------
-- Written only by release_wave().

create table if not exists public.release_waves (
  id bigint generated always as identity primary key,
  includes_rejections boolean not null,
  released_by uuid references public.profiles on delete set null,
  released_at timestamptz not null default now()
);

alter table public.release_waves enable row level security;

drop policy if exists "release_waves_admin_read" on public.release_waves;
create policy "release_waves_admin_read" on public.release_waves
  for select to authenticated using ((select public.is_admin()));

revoke all on public.release_waves from anon;
revoke insert, update, delete on public.release_waves from authenticated;

-- One row per applicant per wave: the email they're owed and whether it went.
create table if not exists public.wave_emails (
  wave_id bigint not null references public.release_waves on delete cascade,
  application_id uuid not null references public.applications on delete cascade,
  decision text not null check (decision in ('accepted', 'waitlisted', 'rejected')),
  sent_at timestamptz,
  error text, -- the last failure, cleared once sent
  attempts int not null default 0,
  claimed_at timestamptz, -- set while a send is in progress
  primary key (wave_id, application_id)
);

create index if not exists wave_emails_unsent_idx on public.wave_emails (wave_id) where sent_at is null;
create index if not exists wave_emails_application_idx on public.wave_emails (application_id);

alter table public.wave_emails enable row level security;

drop policy if exists "wave_emails_admin_read" on public.wave_emails;
create policy "wave_emails_admin_read" on public.wave_emails
  for select to authenticated using ((select public.is_admin()));

-- Admins record send results; who's owed which email is fixed by the wave.
drop policy if exists "wave_emails_admin_update" on public.wave_emails;
create policy "wave_emails_admin_update" on public.wave_emails
  for update to authenticated
  using ((select public.is_admin())) with check ((select public.is_admin()));

revoke all on public.wave_emails from anon;
revoke insert, update, delete on public.wave_emails from authenticated;
grant update (sent_at, error, attempts, claimed_at) on public.wave_emails to authenticated;

-- Release ----------------------------------------------------------------------

-- Releases the staged decisions for submitted applications (rejections only
-- when p_include_rejections), returning the new wave's id and how many it holds.
-- Only rows staged at or before p_staged_before go out: the admin confirmed the
-- counts on a page loaded at that time, so anything staged (or changed) since
-- waits for the next wave instead of being emailed unseen.
-- security definer: admins get no insert on release_waves / wave_emails.
drop function if exists public.release_wave(boolean);
create or replace function public.release_wave(p_include_rejections boolean, p_staged_before timestamptz)
returns table (wave_id bigint, released int)
language plpgsql
security definer
set search_path = ''
as $$
#variable_conflict use_column
declare
  v_wave bigint;
  v_released int;
begin
  if not coalesce(public.is_admin(), false) then
    raise exception 'Admins only';
  end if;
  if p_staged_before is null then
    raise exception 'p_staged_before is required';
  end if;

  -- One release at a time, so two admins can't each release half a wave.
  perform pg_advisory_xact_lock(hashtext('public.release_wave'));

  -- Lock every unsent email (waiting for any claim mid-commit), then refuse while
  -- a batch is sending: it could be about to email a decision this release
  -- replaces. Until we commit, new claims skip these locked rows.
  perform 1 from public.wave_emails where sent_at is null for update;
  if exists (
    select 1 from public.wave_emails
    where sent_at is null and claimed_at > now() - interval '2 minutes'
  ) then
    raise exception 'Emails are still sending';
  end if;

  -- Staged to what they already have: nothing to send.
  delete from public.staged_decisions s
  using public.applications a
  where a.id = s.application_id and a.decision = s.decision;

  if not exists (
    select 1
    from public.staged_decisions s
    join public.applications a on a.id = s.application_id
    where a.status = 'submitted'
      and s.staged_at <= p_staged_before
      and (p_include_rejections or s.decision <> 'rejected')
  ) then
    raise exception 'Nothing to release';
  end if;

  insert into public.release_waves (includes_rejections, released_by)
  values (p_include_rejections, auth.uid())
  returning id into v_wave;

  with released as (
    delete from public.staged_decisions s
    using public.applications a
    where a.id = s.application_id
      and a.status = 'submitted'
      and s.staged_at <= p_staged_before
      and (p_include_rejections or s.decision <> 'rejected')
    returning s.application_id, s.decision
  ), moved as (
    update public.applications a
    set decision = r.decision
    from released r
    where a.id = r.application_id
    returning a.id, a.decision
  )
  insert into public.wave_emails (wave_id, application_id, decision)
  select v_wave, m.id, m.decision from moved m;
  get diagnostics v_released = row_count;

  -- An unsent email from an earlier wave is out of date now (e.g. waitlisted,
  -- then accepted before the waitlist email went), so it must never go out.
  -- Nobody is sending it: we refused above while any claim was active.
  delete from public.wave_emails old
  using public.wave_emails cur
  where cur.wave_id = v_wave
    and old.application_id = cur.application_id
    and old.wave_id <> v_wave
    and old.sent_at is null;

  return query select v_wave, v_released;
end;
$$;

revoke all on function public.release_wave(boolean, timestamptz) from public, anon;
grant execute on function public.release_wave(boolean, timestamptz) to authenticated;

-- Claims up to p_limit unsent emails of a wave for sending, with who to send
-- them to. Rows another request claimed in the last 2 minutes are skipped, so
-- the same email is never handed out twice at once. Security invoker: RLS
-- (admins only) guards it.
create or replace function public.claim_wave_emails(p_wave_id bigint, p_limit int)
returns table (application_id uuid, decision text, email text, first_name text)
language sql
set search_path = ''
as $$
  with picked as (
    select w.wave_id, w.application_id
    from public.wave_emails w
    join public.applications a on a.id = w.application_id
    where w.wave_id = p_wave_id
      and w.sent_at is null
      and (w.claimed_at is null or w.claimed_at < now() - interval '2 minutes')
      -- Never send a decision they no longer have.
      and a.decision = w.decision
    -- Fewest tries first, so a few failing addresses can't hog every batch.
    order by w.attempts, w.application_id
    limit greatest(p_limit, 0)
    for update of w skip locked
  ), claimed as (
    update public.wave_emails w
    set claimed_at = now(), attempts = w.attempts + 1
    from picked p
    where w.wave_id = p.wave_id and w.application_id = p.application_id
    returning w.application_id, w.decision
  )
  select c.application_id, c.decision, a.email, a.first_name
  from claimed c
  join public.applications a on a.id = c.application_id;
$$;

revoke all on function public.claim_wave_emails(bigint, int) from public, anon;
grant execute on function public.claim_wave_emails(bigint, int) to authenticated;

commit;
