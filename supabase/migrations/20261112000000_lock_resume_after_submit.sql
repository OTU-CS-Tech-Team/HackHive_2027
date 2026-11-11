-- Once an application is submitted, its resume is frozen: the applicant can
-- still read it, but can no longer upload, replace or delete files in their
-- resume folder, so reviewers always see the resume that was submitted.

-- security definer so the check doesn't depend on the applications table's own
-- RLS; it only ever looks at the caller's row.
create or replace function public.reg_has_submitted()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.applications
    where user_id = auth.uid() and status = 'submitted'
  );
$$;

revoke all on function public.reg_has_submitted() from public, anon;
grant execute on function public.reg_has_submitted() to authenticated;

drop policy if exists "reg_users_upload_own_resumes" on storage.objects;
create policy "reg_users_upload_own_resumes"
  on storage.objects for insert
  with check (
    bucket_id = 'resumes'
    and auth.uid()::text = (storage.foldername(name))[1]
    and not public.reg_has_submitted()
  );

drop policy if exists "reg_users_update_own_resumes" on storage.objects;
create policy "reg_users_update_own_resumes"
  on storage.objects for update
  using (
    bucket_id = 'resumes'
    and auth.uid()::text = (storage.foldername(name))[1]
    and not public.reg_has_submitted()
  );

drop policy if exists "reg_users_delete_own_resumes" on storage.objects;
create policy "reg_users_delete_own_resumes"
  on storage.objects for delete
  using (
    bucket_id = 'resumes'
    and auth.uid()::text = (storage.foldername(name))[1]
    and not public.reg_has_submitted()
  );
