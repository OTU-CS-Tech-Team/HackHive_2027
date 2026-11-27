-- One row each time an admin presses "Email drafts" on the admin Drafts tab, so the
-- page can show when the last reminder went out, who sent it, and how it went.
-- The counts fill in batch by batch while it sends (sendDraftReminders in
-- src/app/admin/actions.ts), so a run cut short still shows what got out.
--
-- Safe to run more than once, in a single transaction.

begin;

create table if not exists public.draft_reminder_runs (
  id uuid primary key default gen_random_uuid(),
  started_at timestamptz not null default now(),
  sent_by uuid references public.profiles on delete set null,
  recipients int not null check (recipients >= 0), -- drafts confirmed when it started
  sent int not null default 0 check (sent >= 0),
  failed int not null default 0 check (failed >= 0),
  skipped int not null default 0 check (skipped >= 0) -- submitted before their turn
);

create index if not exists draft_reminder_runs_started_at_idx on public.draft_reminder_runs (started_at desc);

alter table public.draft_reminder_runs enable row level security;

-- Admins only. Rows are never deleted from the app; they're the reminder history.
drop policy if exists "draft_reminder_runs_admin_read" on public.draft_reminder_runs;
create policy "draft_reminder_runs_admin_read" on public.draft_reminder_runs
  for select to authenticated using ((select public.is_admin()));

drop policy if exists "draft_reminder_runs_admin_insert" on public.draft_reminder_runs;
create policy "draft_reminder_runs_admin_insert" on public.draft_reminder_runs
  for insert to authenticated
  with check ((select public.is_admin()) and sent_by = (select auth.uid()));

drop policy if exists "draft_reminder_runs_admin_update" on public.draft_reminder_runs;
create policy "draft_reminder_runs_admin_update" on public.draft_reminder_runs
  for update to authenticated
  using ((select public.is_admin())) with check ((select public.is_admin()));

grant select, insert, update on public.draft_reminder_runs to authenticated;

commit;
