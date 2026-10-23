-- psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f tests/sql/teammate-slack.sql
begin;
insert into auth.users (id, email) values ('00000000-0000-4000-8000-000000000901', 'slack-test@example.invalid');
insert into public.profiles (id, full_name, looking_for_team)
  values ('00000000-0000-4000-8000-000000000901', 'Slack test', false)
  on conflict (id) do update set full_name = 'Slack test', looking_for_team = false;
do $$ declare link text; begin
  foreach link in array array[
    'https://hackhive.slack.com/team/U123ABC',
    'https://hackhive.enterprise.slack.com/user/@W123ABC'
  ] loop
    update public.profiles set slack_url = link where id = '00000000-0000-4000-8000-000000000901';
  end loop;
  foreach link in array array[
    'javascript:alert(1)', 'http://hackhive.slack.com/team/U123ABC',
    'https://hackhive.slack.com.evil.test/team/U123ABC',
    'https://hackhive.slack.com/archives/C123ABC', 'https://hackhive.slack.com'
  ] loop
    begin
      update public.profiles set slack_url = link where id = '00000000-0000-4000-8000-000000000901';
      raise exception 'Invalid Slack URL was accepted: %', link;
    exception when check_violation then null;
    end;
  end loop;
  update public.profiles set slack_url = null where id = '00000000-0000-4000-8000-000000000901';
  assert (select slack_url is null and full_name = 'Slack test' and not looking_for_team from public.profiles where id = '00000000-0000-4000-8000-000000000901'), 'Slack is optional and must not change listing privacy or profile data';
end $$;
rollback;
select 'PASS: optional Slack profile constraints and preserved listing privacy' as result;
