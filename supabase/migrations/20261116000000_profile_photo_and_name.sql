-- handle_new_user fills a profile once, at sign-up. Two things drift after that:
--   * the name: hackers expect the name they typed into their application, not
--     their email prefix or Google display name;
--   * the photo: an account made with email first and Google linked later never
--     picks up the Google photo.

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
begin
  if display_name is not null then
    update public.profiles set full_name = display_name
    where id = new.user_id and full_name is distinct from display_name;
  end if;
  return null;
end;
$$;

drop trigger if exists applications_sync_profile_name on public.applications;
create trigger applications_sync_profile_name
  after insert or update of first_name, last_name, preferred_name on public.applications
  for each row execute function public.sync_profile_name();

-- Only fills an empty photo, so a photo the hacker uploaded always wins.
create or replace function public.fill_profile_avatar()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  photo text := coalesce(nullif(new.raw_user_meta_data->>'avatar_url', ''), nullif(new.raw_user_meta_data->>'picture', ''));
begin
  if photo is not null then
    update public.profiles set avatar_url = photo where id = new.id and avatar_url is null;
  end if;
  return null;
end;
$$;

drop trigger if exists on_auth_user_metadata_updated on auth.users;
create trigger on_auth_user_metadata_updated
  after update of raw_user_meta_data on auth.users
  for each row execute function public.fill_profile_avatar();

-- One-off catch-up for accounts that already exist.
update public.profiles p
set full_name = public.application_display_name(a.preferred_name, a.first_name, a.last_name)
from public.applications a
where a.user_id = p.id
  and public.application_display_name(a.preferred_name, a.first_name, a.last_name) is not null
  and p.full_name is distinct from public.application_display_name(a.preferred_name, a.first_name, a.last_name);

update public.profiles p
set avatar_url = coalesce(nullif(u.raw_user_meta_data->>'avatar_url', ''), nullif(u.raw_user_meta_data->>'picture', ''))
from auth.users u
where u.id = p.id
  and p.avatar_url is null
  and coalesce(nullif(u.raw_user_meta_data->>'avatar_url', ''), nullif(u.raw_user_meta_data->>'picture', '')) is not null;
