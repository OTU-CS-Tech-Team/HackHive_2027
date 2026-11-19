-- Blind review meets the Decisions page (needs 20261121000000_blind_review.sql
-- and 20261122000000_release_waves.sql). Two changes:
--
-- 1. review_pool_counts() counts seats from each applicant's effective decision
--    (staged, else released), so it matches the Decisions page trackers:
--    - a review placement counts unless a different decision was staged or
--      released by hand;
--    - anyone else accepted (released, or staged) by hand counts too, slotted
--      in by the review rule (Ontario Tech, then lower years, then everyone
--      else), released ones oldest submission first, then staged ones in the
--      order they were staged.
-- 2. claim_next_review() never deals someone who has a staged decision.
--
-- Safe to run more than once, in a single transaction.

begin;

-- review_pool_counts -----------------------------------------------------------

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
  from public.review_outcomes o
  join public.applications a on a.id = o.application_id
  left join public.staged_decisions sd on sd.application_id = o.application_id
  where o.outcome = 'accepted' and o.pool is not null
    and a.status = 'submitted'
    and coalesce(sd.decision, a.decision, 'accepted') = 'accepted';

  for v_app in
    select a.university, a.year_of_study
    from public.applications a
    left join public.staged_decisions sd on sd.application_id = a.id
    where a.status = 'submitted'
      and coalesce(sd.decision, a.decision) = 'accepted'
      and not exists (
        select 1 from public.review_outcomes o
        where o.application_id = a.id and o.outcome = 'accepted' and o.pool is not null
      )
    -- Released first (oldest submission first), then staged in staging order.
    order by sd.staged_at nulls first, a.submitted_at nulls last, a.id
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

revoke all on function public.review_pool_counts() from public, anon;
grant execute on function public.review_pool_counts() to authenticated;

-- claim_next_review ------------------------------------------------------------
-- As in 20261121000000_blind_review.sql, plus: nobody with a staged decision.

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
    and not exists (select 1 from public.staged_decisions sd where sd.application_id = c.application_id)
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
      and not exists (select 1 from public.staged_decisions sd where sd.application_id = a.id)
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

revoke all on function public.claim_next_review(text) from public, anon;
grant execute on function public.claim_next_review(text) to authenticated;

commit;
