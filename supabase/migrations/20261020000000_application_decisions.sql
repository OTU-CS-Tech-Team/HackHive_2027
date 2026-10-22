-- Admin decisions on submitted applications. null = applied, still waiting.
-- Only accepted hackers (and admins) get the hacker hub: looking for group,
-- hardware, scavenger hunt and the check-in pass.

alter table public.applications
  add column decision text check (decision in ('accepted', 'waitlisted', 'rejected')),
  add constraint applications_decision_needs_submit check (decision is null or status = 'submitted');

-- Hackers can write their own draft row, so stop them deciding for themselves.
-- SQL editor / service role (no auth.uid()) can still set it.
create or replace function public.protect_application_decision()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.decision is distinct from (case when tg_op = 'UPDATE' then old.decision end)
     and auth.uid() is not null and not public.is_admin() then
    raise exception 'Only admins can set a decision';
  end if;
  return new;
end;
$$;

create trigger applications_protect_decision
  before insert or update on public.applications
  for each row execute function public.protect_application_decision();

create policy "admin_users_update_applications" on public.applications
  for update to authenticated
  using ((select public.is_admin())) with check ((select public.is_admin()));

-- security definer: hackers can't read other people's applications.
create or replace function public.is_accepted(uid uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (select 1 from public.applications where user_id = uid and decision = 'accepted');
$$;

create or replace function public.has_hub_access()
returns boolean
language sql
stable
set search_path = ''
as $$
  select public.is_admin() or public.is_accepted(auth.uid());
$$;

revoke all on function public.is_accepted(uuid), public.has_hub_access() from public;
grant execute on function public.is_accepted(uuid), public.has_hub_access() to authenticated;

drop policy "scavenger_items_signed_in_read" on public.scavenger_items;
create policy "scavenger_items_hub_read" on public.scavenger_items
  for select to authenticated using ((select public.has_hub_access()));

drop policy "hardware_items_signed_in_read" on public.hardware_items;
create policy "hardware_items_hub_read" on public.hardware_items
  for select to authenticated using ((select public.has_hub_access()));

-- Teammate finder only shows to (and lists) people who got in.
drop policy "profiles_read" on public.profiles;
create policy "profiles_read" on public.profiles
  for select to authenticated
  using (
    id = (select auth.uid())
    or (looking_for_team and (select public.has_hub_access()) and public.is_accepted(id))
    or (select public.is_admin())
  );

-- No pass until accepted.
drop policy "checkin_tokens_insert_own" on public.checkin_tokens;
create policy "checkin_tokens_insert_own" on public.checkin_tokens
  for insert to authenticated with check (user_id = (select auth.uid()) and (select public.has_hub_access()));
