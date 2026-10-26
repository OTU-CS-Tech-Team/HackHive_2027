-- Read-only: reports schema objects, never hacker data.
-- Run in the same SQL editor/project where the migration failed.
select jsonb_pretty(jsonb_build_object(
  'database', current_database(),
  'role', current_user,
  'private_schema_exists', exists(select 1 from pg_namespace where nspname='team_internal'),
  'tables', (select jsonb_object_agg(name, to_regclass(name)::text) from unnest(array[
    'public.profiles','public.teammate_bookmarks','public.recruiting_teams',
    'public.team_memberships','public.team_join_requests'
  ]) name),
  'profile_team_columns', (select coalesce(jsonb_agg(column_name order by ordinal_position),'[]'::jsonb)
    from information_schema.columns where table_schema='public' and table_name='profiles'
      and column_name like 'team\_%' escape '\'),
  'profile_triggers', (select coalesce(jsonb_agg(jsonb_build_object('name',tgname,'definition',pg_get_triggerdef(oid))),'[]'::jsonb)
    from pg_trigger where tgrelid=to_regclass('public.profiles') and not tgisinternal),
  'team_functions', (select coalesce(jsonb_agg(n.nspname||'.'||p.proname order by p.proname),'[]'::jsonb)
    from pg_proc p join pg_namespace n on n.oid=p.pronamespace
    where n.nspname='team_internal' or (n.nspname='public' and
      (p.proname like 'team\_%' escape '\' or p.proname in (
        'confirm_teammate_availability','set_teammate_bookmark','request_team_join','review_team_join'))))
)) as teammate_migration_state;
