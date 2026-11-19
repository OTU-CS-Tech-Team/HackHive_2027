-- Total points held across all hackers, summed in the database so the admin
-- overview isn't capped at Supabase's 1000-row limit.
-- security invoker: point_transactions RLS already lets admins read every row;
-- the explicit check makes anyone else get an error instead of their own total.
create or replace function public.admin_points_total()
returns bigint
language plpgsql
stable
set search_path = ''
as $$
begin
  if not public.is_admin() then
    raise exception 'Admins only' using errcode = '42501';
  end if;
  return (select coalesce(sum(amount), 0)::bigint from public.point_transactions);
end;
$$;

revoke execute on function public.admin_points_total() from public, anon;
grant execute on function public.admin_points_total() to authenticated;
