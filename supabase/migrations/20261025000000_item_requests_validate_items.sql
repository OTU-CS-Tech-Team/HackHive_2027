-- The items check in 20261019000000_item_requests.sql only insisted on a non-empty
-- array, so anyone calling the API directly (skipping the server action's checks)
-- could store entries like [null] or a quantity of 50. This checks every entry.
--
-- Each entry must be { "category": "hardware" | "toiletries" | "other",
-- "name": 1-100 characters, "quantity": a whole number of at least 1 }, and the
-- quantities can add up to at most 5 (MAX_ITEMS in src/lib/itemRequests.ts).

create function public.item_requests_items_valid(items jsonb)
returns boolean
language plpgsql
immutable
set search_path = ''
as $$
declare
  item jsonb;
  quantity numeric;
  total numeric := 0;
begin
  if items is null or jsonb_typeof(items) <> 'array' or jsonb_array_length(items) = 0 then
    return false;
  end if;

  for item in select value from jsonb_array_elements(items) loop
    -- Also rejects null, strings, numbers and nested arrays.
    if jsonb_typeof(item) <> 'object' then
      return false;
    end if;

    if jsonb_typeof(item -> 'category') is distinct from 'string'
      or item ->> 'category' not in ('hardware', 'toiletries', 'other') then
      return false;
    end if;

    if jsonb_typeof(item -> 'name') is distinct from 'string'
      or length(btrim(item ->> 'name')) not between 1 and 100 then
      return false;
    end if;

    -- Checked as a number before converting, so "abc" or true can't raise an error.
    if jsonb_typeof(item -> 'quantity') is distinct from 'number' then
      return false;
    end if;
    quantity := (item ->> 'quantity')::numeric;
    if quantity < 1 or quantity <> trunc(quantity) then
      return false;
    end if;

    total := total + quantity;
  end loop;

  return total <= 5;
end;
$$;

-- Added as "not valid" and then validated, so if any bad rows already exist this
-- migration stops with an error instead of silently changing them. To find them:
--   select id, items from public.item_requests
--   where not public.item_requests_items_valid(items);
alter table public.item_requests
  add constraint item_requests_items_valid check (public.item_requests_items_valid(items)) not valid;

alter table public.item_requests validate constraint item_requests_items_valid;
