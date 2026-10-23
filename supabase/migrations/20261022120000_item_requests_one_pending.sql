-- Each hacker can have only one pending request at a time. Once it's accepted
-- or rejected they can send another.

create unique index item_requests_one_pending_per_user
  on public.item_requests (user_id)
  where status = 'pending';
