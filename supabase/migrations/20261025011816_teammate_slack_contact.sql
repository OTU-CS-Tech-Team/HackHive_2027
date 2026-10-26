-- Publish a team-specific contact rather than exposing its owner's private row.
-- Existing posts stay intact; their owners can add a Slack link in the editor.
do $migration$
begin
  alter table public.recruiting_teams add column slack_url text
    constraint recruiting_teams_slack_member check (
      slack_url is null or (length(slack_url)<=500 and
        slack_url ~* '^https://([a-z0-9-]+\.)+slack\.com/(team/[uw][a-z0-9]+|user/@[uw][a-z0-9]+)/?$')
    );
  -- Retire website requests without deleting historical requests or rosters.
  revoke execute on function public.request_team_join(uuid,text),public.review_team_join(uuid,boolean) from authenticated;
  revoke insert,update,delete on public.team_join_requests from authenticated;
end;
$migration$;
