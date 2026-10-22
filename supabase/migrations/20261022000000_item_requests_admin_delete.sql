-- Admins can delete requests that have already been accepted or rejected.
-- Pending requests can't be deleted, so nobody can skip the queue by clearing it.

create policy "item_requests_admin_delete" on public.item_requests
  for delete to authenticated
  using ((select public.is_admin()) and status <> 'pending');

grant delete on public.item_requests to authenticated;
