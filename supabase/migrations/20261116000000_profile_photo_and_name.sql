-- NEEDS SIGN-OFF before it goes near the HackHive Supabase: it adds a trigger
-- to the existing public.applications table. It touches no existing rows.
--
-- handle_new_user names a profile once, at sign-up, from the Google name or the
-- email prefix. Hackers expect the name they typed into their application, so
-- this copies that name over, but only while the profile still holds a
-- sign-up default (or the application name it copied earlier). A name set on
-- the Profile tab is never overwritten.

-- "Tabby Ghouri": preferred (or first) name plus last name. Null until there is
-- a first or preferred name, so a half-typed draft never blanks the profile.
create or replace function public.application_display_name(preferred text, first text, last text)
returns text
language sql
immutable
set search_path = ''
as $$
  select case
    when coalesce(nullif(btrim(preferred), ''), nullif(btrim(first), '')) is null then null
    else concat_ws(' ', coalesce(nullif(btrim(preferred), ''), nullif(btrim(first), '')), nullif(btrim(last), ''))
  end
$$;

create or replace function public.sync_profile_name()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  display_name text := public.application_display_name(new.preferred_name, new.first_name, new.last_name);
  previous text := case when tg_op = 'UPDATE'
    then public.application_display_name(old.preferred_name, old.first_name, old.last_name) end;
begin
  if display_name is not null then
    update public.profiles p set full_name = display_name
    from auth.users u
    where p.id = new.user_id
      and u.id = p.id
      and p.full_name is distinct from display_name
      and (
        nullif(btrim(p.full_name), '') is null
        or p.full_name = previous
        -- Anything handle_new_user could have filled in.
        or p.full_name in (
          u.raw_user_meta_data->>'full_name',
          u.raw_user_meta_data->>'name',
          u.raw_user_meta_data->>'user_name',
          split_part(coalesce(u.email, ''), '@', 1)
        )
      );
  end if;
  return null;
end;
$$;

drop trigger if exists applications_sync_profile_name on public.applications;
create trigger applications_sync_profile_name
  after insert or update of first_name, last_name, preferred_name on public.applications
  for each row execute function public.sync_profile_name();
