-- Each hacker can now have up to three pending requests at a time (was one, in
-- 20261022120000_item_requests_one_pending.sql). A unique index can't count to
-- three, so a trigger checks instead.

drop index if exists public.item_requests_one_pending_per_user;

create function public.item_requests_check_pending_limit()
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

create trigger item_requests_pending_limit
  before insert on public.item_requests
  for each row execute function public.item_requests_check_pending_limit();

-- Where each of the caller's pending requests is in line: 1 is next up. Hackers
-- can only read their own rows, so this runs as the owner to count everyone
-- else's pending requests ahead of theirs, and returns only the caller's rows.
create function public.my_item_request_positions()
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
