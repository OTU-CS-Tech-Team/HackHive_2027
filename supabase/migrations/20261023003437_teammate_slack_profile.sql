-- Optional member-profile link for the existing opt-in teammate directory.
-- Existing profile data, grants, and row-level security policies are preserved.
alter table public.profiles
  add column slack_url text,
  add constraint profiles_slack_url_member check (
    slack_url is null or (
      length(slack_url) <= 500 and
      slack_url ~* '^https://([a-z0-9-]+\.)+slack\.com/(team/[uw][a-z0-9]+|user/@[uw][a-z0-9]+)/?$'
    )
  );
