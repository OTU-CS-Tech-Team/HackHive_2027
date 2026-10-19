-- Dashboard QR codes + points for attending events.

-- ── Check-in tokens ─────────────────────────────────────────────────────────
-- The dashboard QR encodes a short-lived random token, not the user id, so a
-- screenshotted code goes stale in minutes. Hackers keep one live token; an
-- admin scan resolves it to a hacker (and their emergency info).

create table public.checkin_tokens (
  token uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles on delete cascade,
  expires_at timestamptz not null default now() + interval '5 minutes'
);

create index checkin_tokens_user_id_idx on public.checkin_tokens (user_id);

alter table public.checkin_tokens enable row level security;

create policy "checkin_tokens_read" on public.checkin_tokens
  for select to authenticated
  using (user_id = (select auth.uid()) or (select public.is_admin()));

create policy "checkin_tokens_insert_own" on public.checkin_tokens
  for insert to authenticated with check (user_id = (select auth.uid()));

create policy "checkin_tokens_delete_own" on public.checkin_tokens
  for delete to authenticated using (user_id = (select auth.uid()));

grant select, insert, delete on public.checkin_tokens to authenticated;

-- ── Profile links ───────────────────────────────────────────────────────────
-- Shown as links to other hackers (teammate finder), and hackers can write
-- their own row straight through the API, so enforce web URLs here.

alter table public.profiles
  add constraint profiles_linkedin_url_web check (linkedin_url ~* '^https?://'),
  add constraint profiles_github_url_web check (github_url ~* '^https?://'),
  add constraint profiles_instagram_url_web check (instagram_url ~* '^https?://');

-- ── Event points ────────────────────────────────────────────────────────────
-- Scanning someone in at an event awards that event's points, once.

alter table public.events add column points int not null default 0 check (points >= 0);

alter table public.point_transactions add column event_id uuid references public.events on delete set null;

create unique index point_transactions_once_per_event
  on public.point_transactions (user_id, event_id) where event_id is not null;
