-- Apply before deploying the category-ID editor. Existing open schedules still
-- read the enum; old admin forms still write it. Keep both representations valid.
-- One atomic statement also supports SQL editor/prepared-statement execution.
do $migration$
begin
execute $compatibility$
alter table public.event_categories add column legacy_category public.event_category unique;

update public.event_categories set legacy_category = case name
  when 'HackHive' then 'hackhive'::public.event_category
  when 'Sponsor workshops' then 'workshop'::public.event_category
  when 'Fun events' then 'fun'::public.event_category
  when 'Food' then 'food'::public.event_category
  when 'Ceremonies' then 'ceremony'::public.event_category
end;

-- Recover aliases for a built-in category renamed before this migration, using
-- its pre-existing events. Once stored, aliases survive all later name edits.
update public.event_categories c set legacy_category = mapping.category
from (
  select distinct on (category) category_id, category
  from public.events where category is not null
  order by category, category_id
) mapping
where c.id = mapping.category_id and c.legacy_category is null
  and not exists (select 1 from public.event_categories mapped where mapped.legacy_category = mapping.category);

-- Custom categories appear as general HackHive events to old clients. New
-- clients continue to use the exact category ID, name and colour.
update public.events e set category = coalesce(c.legacy_category, 'hackhive'::public.event_category)
from public.event_categories c where c.id = e.category_id;
alter table public.events alter column category set not null;

create function public.sync_event_category() returns trigger
language plpgsql security invoker set search_path = '' as $$
begin
  if TG_OP = 'UPDATE' then
    if new.category_id is not distinct from old.category_id and new.category is distinct from old.category then
      -- The old editor changed the enum without knowing about category_id.
      new.category_id = null;
    end if;
  end if;

  if new.category_id is null then
    select id into new.category_id from public.event_categories where legacy_category = new.category;
    if not found then
      raise foreign_key_violation using message = 'That category no longer exists. Reload and pick another.';
    end if;
  end if;

  -- An explicitly supplied/changed ID wins when both columns are provided.
  select coalesce(legacy_category, 'hackhive'::public.event_category) into new.category
    from public.event_categories where id = new.category_id;
  if not found then
    raise foreign_key_violation using message = 'That category no longer exists. Reload and pick another.';
  end if;
  return new;
end;
$$;

revoke all on function public.sync_event_category() from public, anon, authenticated;
create trigger events_sync_category before insert or update on public.events
  for each row execute function public.sync_event_category();
$compatibility$;
end;
$migration$;
