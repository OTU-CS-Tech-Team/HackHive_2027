-- Admin whitelist by email. Adding an email makes that person an admin as
-- soon as they have a confirmed account: right away if they already signed
-- up, otherwise the moment they sign up / confirm their email.
--   insert into public.admin_emails (email) values ('someone@ontariotechu.net');
-- Removing someone takes both rows (deleting the email alone doesn't revoke):
--   delete from public.admin_emails where email = 'someone@ontariotechu.net';
--   delete from public.admin_users where user_id = (select id from auth.users where lower(email) = 'someone@ontariotechu.net');

create table public.admin_emails (
  email text primary key check (email = lower(email)),
  created_at timestamptz not null default now()
);

-- No policies: only the SQL editor (service role) can read or write it.
alter table public.admin_emails enable row level security;

-- Only confirmed emails, so nobody can claim an admin email by signing up
-- with it and never verifying.
create or replace function public.grant_whitelisted_admin()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.email_confirmed_at is not null
     and exists (select 1 from public.admin_emails where email = lower(new.email)) then
    insert into public.admin_users (user_id) values (new.id) on conflict do nothing;
  end if;
  return new;
end;
$$;

create trigger on_auth_user_admin_whitelist
  after insert or update of email_confirmed_at on auth.users
  for each row execute function public.grant_whitelisted_admin();

-- Whitelisting someone who already has an account.
create or replace function public.grant_admin_to_existing_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.admin_users (user_id)
  select id from auth.users where lower(email) = new.email and email_confirmed_at is not null
  on conflict do nothing;
  return new;
end;
$$;

create trigger admin_emails_grant_existing
  after insert on public.admin_emails
  for each row execute function public.grant_admin_to_existing_user();
