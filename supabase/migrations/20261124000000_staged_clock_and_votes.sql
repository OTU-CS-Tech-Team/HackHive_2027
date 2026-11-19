-- Two fixes on top of 20261121000000_blind_review.sql,
-- 20261122000000_release_waves.sql and 20261123000000_review_decisions.sql:
--
-- 1. staged_at is stamped by the database (clock_timestamp(), so rows staged
--    together keep their order) on every insert and update. Release only sends
--    what was staged up to the newest time the admin saw, so that time must
--    come from one clock, not from whichever app server handled the request.
-- 2. cast_review_vote() treats someone with a staged decision as decided, so a
--    vote cast while their card was open can't record an outcome for them.
--
-- Safe to run more than once, in a single transaction.

begin;

-- staged_at ------------------------------------------------------------------

create or replace function public.stamp_staged_decision()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.staged_at := clock_timestamp();
  return new;
end;
$$;

drop trigger if exists staged_decisions_stamp on public.staged_decisions;
create trigger staged_decisions_stamp
  before insert or update on public.staged_decisions
  for each row execute function public.stamp_staged_decision();

-- cast_review_vote -------------------------------------------------------------
-- As in 20261121000000_blind_review.sql, plus: a staged decision counts as decided.

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
     or exists (select 1 from public.review_outcomes o where o.application_id = p_application_id)
     or exists (select 1 from public.staged_decisions sd where sd.application_id = p_application_id) then
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

revoke all on function public.cast_review_vote(uuid, text) from public, anon;
grant execute on function public.cast_review_vote(uuid, text) to authenticated;

commit;
