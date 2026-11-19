-- Hive Mind scoring fixes (PR #51 review):
--
-- 1. A per-row lock (claim_token / claimed_at), so the same applicant is never
--    graded twice at once (submit's after() vs "Score now" vs Re-score). Status
--    now only ever means the result of the last finished grading: a failed
--    re-score keeps the earlier score instead of hiding it. A claim older than
--    2 minutes is stale (the request was killed) and can be taken over.
-- 2. attempts counts tries since the last success, and the backlog tries the
--    fewest-attempts first and skips anyone who failed 5 times in a row, so a
--    few broken applications can't block everyone behind them.
-- 3. applications.phone_digits, so the duplicate-phone check is one indexed
--    lookup instead of loading every phone. Same rule as normalizePhone in
--    src/lib/hive/flags.ts: digits only, the last 10, at least 7 or null.
-- 4. hive_backlog() returns the next few to score in one query.
--
-- Only the service role (the server's scoring code) can call these functions.
-- Safe to run more than once.

begin;

alter table public.hive_scores add column if not exists claim_token uuid;
alter table public.hive_scores add column if not exists claimed_at timestamptz;

-- Old meaning was "every try ever"; from here it's "tries since the last success".
update public.hive_scores set attempts = 0 where status = 'scored';

alter table public.applications add column if not exists phone_digits text generated always as (
  case
    when length(regexp_replace(coalesce(phone, ''), '[^0-9]', '', 'g')) >= 7
      then right(regexp_replace(phone, '[^0-9]', '', 'g'), 10)
  end
) stored;

create index if not exists applications_phone_digits_idx
  on public.applications (phone_digits) where status = 'submitted' and phone_digits is not null;

-- Claims an applicant for grading. Returns the claim, or no row if someone else
-- is already grading them.
create or replace function public.claim_hive_score(p_application_id uuid, p_stale_after interval default interval '2 minutes')
returns table (claim_token uuid, attempts int, status text, flags text[])
language sql
set search_path = ''
as $$
  insert into public.hive_scores as s (application_id, status, attempts, claim_token, claimed_at)
  values (p_application_id, 'pending', 1, gen_random_uuid(), now())
  on conflict (application_id) do update
    set claim_token = gen_random_uuid(), claimed_at = now(), attempts = s.attempts + 1, updated_at = now()
    where s.claimed_at is null or s.claimed_at < now() - p_stale_after
  returning s.claim_token, s.attempts, s.status, s.flags;
$$;

-- The next p_limit submitted applications to grade, with how many are waiting in
-- all. Skips current scores, anyone mid-grading, and anyone who failed
-- p_max_attempts times in a row (an admin can still Re-score them).
create or replace function public.hive_backlog(p_prompt_version int, p_limit int, p_max_attempts int default 5)
returns table (application_id uuid, total bigint)
language sql
stable
set search_path = ''
as $$
  select a.id, count(*) over ()
  from public.applications a
  left join public.hive_scores s on s.application_id = a.id
  where a.status = 'submitted'
    and (s.application_id is null or s.status <> 'scored' or s.prompt_version is distinct from p_prompt_version)
    and (s.claimed_at is null or s.claimed_at < now() - interval '2 minutes')
    -- coalesce: with no score row yet, the comparison is null and would drop them
    and not coalesce(s.status = 'failed' and s.attempts >= p_max_attempts, false)
  order by coalesce(s.attempts, 0), a.submitted_at nulls last, a.id
  limit p_limit;
$$;

-- Adds a flag to existing score rows (the earlier half of a duplicate pair).
create or replace function public.add_hive_flag(p_application_ids uuid[], p_flag text)
returns void
language sql
set search_path = ''
as $$
  update public.hive_scores
  set flags = array_append(flags, p_flag)
  where application_id = any(p_application_ids) and not (p_flag = any(flags));
$$;

revoke all on function public.claim_hive_score(uuid, interval) from public, anon, authenticated;
revoke all on function public.hive_backlog(int, int, int) from public, anon, authenticated;
revoke all on function public.add_hive_flag(uuid[], text) from public, anon, authenticated;
grant execute on function public.claim_hive_score(uuid, interval) to service_role;
grant execute on function public.hive_backlog(int, int, int) to service_role;
grant execute on function public.add_hive_flag(uuid[], text) to service_role;

commit;
