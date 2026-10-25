begin;

-- Run this entire file, including BEGIN/COMMIT, in the SQL editor.
-- Establish the private namespace before any migration objects are defined.
create schema if not exists team_internal;
revoke all on schema team_internal from public,anon,authenticated;

-- Rich, opt-in teammate profiles. Never add email to a directory projection.
create function public.team_tags_valid(tags text[]) returns boolean
language sql immutable set search_path = '' as $$
  select cardinality(tags) <= 10 and not exists (
    select 1 from unnest(tags) tag where tag is null or length(btrim(tag)) not between 1 and 32
  );
$$;

alter table public.profiles
  add column team_bio text not null default '' check (length(team_bio) <= 280),
  add column team_skills text[] not null default '{}' check (public.team_tags_valid(team_skills)),
  add column team_roles text[] not null default '{}' check (public.team_tags_valid(team_roles)),
  add column team_seeking text[] not null default '{}' check (public.team_tags_valid(team_seeking)),
  add column team_interests text[] not null default '{}' check (public.team_tags_valid(team_interests)),
  add column team_goal text check (team_goal in ('learn','compete','both')),
  add column team_experience text check (team_experience in ('first','returning')),
  add column team_found boolean not null default false,
  add column team_confirmed_at timestamptz;

create table public.teammate_bookmarks (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references public.profiles(id) on delete cascade,
  target_id uuid not null references public.profiles(id) on delete cascade,
  saved boolean not null default false,
  reached_out boolean not null default false,
  unique(owner_id,target_id), check(owner_id <> target_id)
);

create table public.recruiting_teams (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null unique references public.profiles(id) on delete cascade,
  name text not null check(length(btrim(name)) between 2 and 60),
  pitch text not null check(length(btrim(pitch)) between 10 and 500),
  roles_needed text[] not null default '{}' check(public.team_tags_valid(roles_needed)),
  interests text[] not null default '{}' check(public.team_tags_valid(interests)),
  goal text not null default 'both' check(goal in ('learn','compete','both')),
  capacity integer not null default 4 check(capacity between 2 and 4),
  status text not null default 'recruiting' check(status in ('recruiting','closed')),
  created_at timestamptz not null default now()
);

create table public.team_memberships (
  id uuid primary key default gen_random_uuid(),
  team_id uuid not null references public.recruiting_teams(id) on delete cascade,
  user_id uuid not null unique references public.profiles(id) on delete cascade,
  display_name text not null check(length(display_name) between 1 and 200),
  joined_at timestamptz not null default now(),
  unique(team_id,user_id)
);

create table public.team_join_requests (
  id uuid primary key default gen_random_uuid(),
  team_id uuid not null references public.recruiting_teams(id) on delete cascade,
  applicant_id uuid not null references public.profiles(id) on delete cascade,
  applicant_name text not null check(length(applicant_name) between 1 and 200),
  message text not null check(length(btrim(message)) between 10 and 500),
  status text not null default 'pending' check(status in ('pending','accepted','declined','withdrawn')),
  created_at timestamptz not null default now(),
  unique(team_id,applicant_id)
);
create index team_join_requests_applicant on public.team_join_requests(applicant_id);
create index teammate_bookmarks_target on public.teammate_bookmarks(target_id);

alter table public.teammate_bookmarks enable row level security;
alter table public.recruiting_teams enable row level security;
alter table public.team_memberships enable row level security;
alter table public.team_join_requests enable row level security;
revoke all on public.teammate_bookmarks,public.recruiting_teams,public.team_memberships,public.team_join_requests from anon;
grant select,insert,update,delete on public.teammate_bookmarks,public.recruiting_teams,public.team_join_requests to authenticated;
grant select,insert,delete on public.team_memberships to authenticated;
grant all on public.teammate_bookmarks,public.recruiting_teams,public.team_memberships,public.team_join_requests to service_role;

create policy bookmarks_private on public.teammate_bookmarks for all to authenticated
  using(owner_id=(select auth.uid()) and (select public.has_hub_access()))
  with check(owner_id=(select auth.uid()) and (select public.has_hub_access()));
create policy teams_hub_read on public.recruiting_teams for select to authenticated
  using((select public.has_hub_access()));
create policy teams_owner_insert on public.recruiting_teams for insert to authenticated
  with check(owner_id=(select auth.uid()) and (select public.has_hub_access()));
create policy teams_owner_update on public.recruiting_teams for update to authenticated
  using(owner_id=(select auth.uid()) and (select public.has_hub_access()))
  with check(owner_id=(select auth.uid()) and (select public.has_hub_access()));
create policy teams_owner_delete on public.recruiting_teams for delete to authenticated
  using(owner_id=(select auth.uid()) and (select public.has_hub_access()));
create policy members_hub_read on public.team_memberships for select to authenticated
  using((select public.has_hub_access()));
create policy members_owner_insert on public.team_memberships for insert to authenticated
  with check((select public.has_hub_access()) and exists (
    select 1 from public.recruiting_teams t where t.id=team_id and t.owner_id=(select auth.uid())
  ) and (user_id=(select auth.uid()) or exists (
    select 1 from public.team_join_requests r where r.team_id=team_memberships.team_id
      and r.applicant_id=user_id and r.status='accepted'
  )));
create policy members_leave on public.team_memberships for delete to authenticated
  using(user_id=(select auth.uid()) and (select public.has_hub_access()) and exists (
    select 1 from public.recruiting_teams t where t.id=team_id and t.owner_id <> (select auth.uid())
  ));
create policy requests_private_read on public.team_join_requests for select to authenticated
  using((select public.has_hub_access()) and (applicant_id=(select auth.uid()) or exists (
    select 1 from public.recruiting_teams t where t.id=team_id and t.owner_id=(select auth.uid())
  )));
create policy requests_self_insert on public.team_join_requests for insert to authenticated
  with check((select public.has_hub_access()) and applicant_id=(select auth.uid()) and status='pending'
    and not exists(select 1 from public.team_memberships m where m.user_id=(select auth.uid()))
    and exists(select 1 from public.recruiting_teams t where t.id=team_id
      and t.status='recruiting' and t.owner_id <> (select auth.uid())));
create policy requests_owner_review on public.team_join_requests for update to authenticated
  using((select public.has_hub_access()) and status='pending' and exists (
    select 1 from public.recruiting_teams t where t.id=team_id and t.owner_id=(select auth.uid())))
  with check((select public.has_hub_access()) and status in ('accepted','declined') and exists (
    select 1 from public.recruiting_teams t where t.id=team_id and t.owner_id=(select auth.uid())));
create policy requests_self_withdraw on public.team_join_requests for update to authenticated
  using((select public.has_hub_access()) and applicant_id=(select auth.uid()) and status='pending')
  with check((select public.has_hub_access()) and applicant_id=(select auth.uid()) and status='withdrawn');
create policy requests_self_reapply on public.team_join_requests for update to authenticated
  using((select public.has_hub_access()) and applicant_id=(select auth.uid()) and status in ('declined','withdrawn','accepted'))
  with check((select public.has_hub_access()) and applicant_id=(select auth.uid()) and status='pending'
    and not exists(select 1 from public.team_memberships m where m.user_id=(select auth.uid()))
    and exists(select 1 from public.recruiting_teams t where t.id=team_id and t.status='recruiting' and t.owner_id<>(select auth.uid())));

-- Keep team ownership and request identity immutable, even through direct REST writes.
create function public.team_request_identity_guard() returns trigger
language plpgsql security invoker set search_path='' as $$
begin
  if new.team_id<>old.team_id or new.applicant_id<>old.applicant_id then
    raise exception 'A join request cannot be reassigned or rewritten';
  end if;
  if (new.applicant_name<>old.applicant_name or new.message<>old.message) and not
    (old.applicant_id=auth.uid() and old.status in ('declined','withdrawn','accepted') and new.status='pending') then
    raise exception 'Only a new request can change its introduction';
  end if;
  return new;
end;
$$;
create trigger team_request_identity before update on public.team_join_requests
  for each row execute function public.team_request_identity_guard();

create function public.team_capacity_guard() returns trigger
language plpgsql security invoker set search_path='' as $$
begin
  if new.owner_id<>old.owner_id then raise exception 'Team ownership cannot be reassigned'; end if;
  if new.capacity < (select count(*) from public.team_memberships where team_id=new.id) then
    raise exception 'Team size cannot be smaller than its current membership';
  end if;
  return new;
end;
$$;
create trigger team_capacity before update on public.recruiting_teams
  for each row execute function public.team_capacity_guard();

-- Lock the team row before checking capacity. Concurrent approvals cannot overfill it.
create function public.team_membership_guard() returns trigger
language plpgsql security invoker set search_path='' as $$
declare t public.recruiting_teams;
begin
  select * into t from public.recruiting_teams where id=new.team_id for update;
  if t.id is null then raise exception 'Team unavailable'; end if;
  if t.owner_id<>auth.uid() then raise exception 'Only the team owner can add an approved member'; end if;
  if t.status<>'recruiting' and new.user_id<>t.owner_id then raise exception 'This team is not recruiting'; end if;
  if (select count(*) from public.team_memberships where team_id=t.id)>=t.capacity then
    raise exception 'This team is full';
  end if;
  if new.user_id=t.owner_id then
    select left(coalesce(nullif(btrim(full_name),''),'Hacker'),200) into new.display_name
      from public.profiles where id=new.user_id;
  else
    select applicant_name into new.display_name from public.team_join_requests
      where team_id=t.id and applicant_id=new.user_id and status='accepted';
    if new.display_name is null then raise exception 'An accepted join request is required'; end if;
  end if;
  return new;
end;
$$;
create trigger team_membership_capacity before insert on public.team_memberships
  for each row execute function public.team_membership_guard();

create function public.team_add_owner() returns trigger
language plpgsql security invoker set search_path='' as $$
begin
  insert into public.team_memberships(team_id,user_id,display_name) values(new.id,new.owner_id,'Owner');
  return new;
end;
$$;
create trigger team_owner_membership after insert on public.recruiting_teams
  for each row execute function public.team_add_owner();

-- This non-exposed trigger is the only privileged cross-user write. Joining a
-- team hides that member's listing and withdraws their other pending requests.
-- It never lists someone automatically. Clients cannot call this function.
create function team_internal.member_joined() returns trigger
language plpgsql security definer set search_path='' as $$
begin
  if not (public.is_accepted(new.user_id) or exists(select 1 from public.admin_users where user_id=new.user_id)) then
    raise exception 'This hacker no longer has accepted-hacker access';
  end if;
  update public.profiles set looking_for_team=false,team_found=true where id=new.user_id;
  update public.team_join_requests set status='withdrawn' where applicant_id=new.user_id and status='pending';
  return new;
end;
$$;
revoke all on function team_internal.member_joined() from public,anon,authenticated;
create trigger team_hide_joined_profile after insert on public.team_memberships
  for each row execute function team_internal.member_joined();

create function public.team_profile_availability_guard() returns trigger
language plpgsql security invoker set search_path='' as $$
begin
  if exists(select 1 from public.team_memberships where user_id=new.id) then
    new.looking_for_team=false; new.team_found=true;
  elsif new.team_found and not old.team_found then
    new.looking_for_team=false;
  elsif new.looking_for_team then
    new.team_found=false;
    if not old.looking_for_team or new.team_confirmed_at is distinct from old.team_confirmed_at then
      new.team_confirmed_at=clock_timestamp();
    end if;
  end if;
  return new;
end;
$$;
create trigger team_profile_availability before update on public.profiles
  for each row execute function public.team_profile_availability_guard();

create function public.confirm_teammate_availability(p_listed boolean,p_found boolean default false)
returns void language plpgsql security invoker set search_path='' as $$
begin
  if not public.has_hub_access() then raise exception 'Accepted hacker access required'; end if;
  if p_listed and exists(select 1 from public.team_memberships where user_id=auth.uid()) then
    raise exception 'Leave your current team before making your listing available';
  end if;
  if p_listed and not exists(select 1 from public.profiles where id=auth.uid() and
    coalesce(slack_url,github_url,linkedin_url,instagram_url) is not null) then
    raise exception 'Add a connection link before making your profile discoverable';
  end if;
  update public.profiles set looking_for_team=p_listed,team_found=p_found and not p_listed,
    team_confirmed_at=case when p_listed then clock_timestamp() else team_confirmed_at end where id=auth.uid();
end;
$$;

create function public.set_teammate_bookmark(p_target uuid,p_saved boolean default null,p_reached_out boolean default null)
returns void language plpgsql security invoker set search_path='' as $$
begin
  if not public.has_hub_access() or p_target=auth.uid() then raise exception 'Invalid teammate'; end if;
  if not exists(select 1 from public.profiles where id=p_target and looking_for_team) then
    raise exception 'This hacker is no longer listed';
  end if;
  insert into public.teammate_bookmarks(owner_id,target_id,saved,reached_out)
    values(auth.uid(),p_target,coalesce(p_saved,false),coalesce(p_reached_out,false))
    on conflict(owner_id,target_id) do update set
      saved=coalesce(p_saved,teammate_bookmarks.saved),
      reached_out=coalesce(p_reached_out,teammate_bookmarks.reached_out);
end;
$$;

create function public.request_team_join(p_team uuid,p_message text) returns void
language plpgsql security invoker set search_path='' as $$
declare t public.recruiting_teams; applicant text;
begin
  if not public.has_hub_access() then raise exception 'Accepted hacker access required'; end if;
  if exists(select 1 from public.team_memberships where user_id=auth.uid()) then raise exception 'You already have a team'; end if;
  select * into t from public.recruiting_teams where id=p_team and status='recruiting' and owner_id<>auth.uid();
  if t.id is null then raise exception 'This team is no longer recruiting'; end if;
  if (select count(*) from public.team_memberships where team_id=t.id)>=t.capacity then raise exception 'This team is full'; end if;
  select left(coalesce(nullif(btrim(full_name),''),'Hacker'),200) into applicant from public.profiles where id=auth.uid();
  insert into public.team_join_requests(team_id,applicant_id,applicant_name,message)
    values(p_team,auth.uid(),applicant,btrim(p_message))
    on conflict(team_id,applicant_id) do update set applicant_name=excluded.applicant_name,
      message=excluded.message,status='pending',created_at=now()
      where team_join_requests.status<>'pending';
  if not found then raise exception 'You already have a pending request for this team'; end if;
end;
$$;

create function public.review_team_join(p_request uuid,p_accept boolean) returns void
language plpgsql security invoker set search_path='' as $$
declare r public.team_join_requests; t public.recruiting_teams;
begin
  if not public.has_hub_access() then raise exception 'Accepted hacker access required'; end if;
  select * into r from public.team_join_requests where id=p_request and status='pending';
  if r.id is null then raise exception 'This request is no longer pending'; end if;
  select * into t from public.recruiting_teams where id=r.team_id and owner_id=auth.uid() for update;
  if t.id is null then raise exception 'Only the team owner can review requests'; end if;
  select * into r from public.team_join_requests where id=p_request and status='pending' for update;
  if r.id is null then raise exception 'This request is no longer pending'; end if;
  update public.team_join_requests set status=case when p_accept then 'accepted' else 'declined' end where id=r.id;
  if p_accept then
    insert into public.team_memberships(team_id,user_id,display_name) values(t.id,r.applicant_id,r.applicant_name);
  end if;
end;
$$;

revoke all on function public.confirm_teammate_availability(boolean,boolean),public.set_teammate_bookmark(uuid,boolean,boolean),
  public.request_team_join(uuid,text),public.review_team_join(uuid,boolean) from public,anon;
grant execute on function public.confirm_teammate_availability(boolean,boolean),public.set_teammate_bookmark(uuid,boolean,boolean),
  public.request_team_join(uuid,text),public.review_team_join(uuid,boolean) to authenticated;

commit;
