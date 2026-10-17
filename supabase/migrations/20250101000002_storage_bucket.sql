-- HackHive 2027 Registration Backend Schema
-- Migration 2: Storage bucket for resumes
--
-- IMPORTANT: This migration ONLY creates new objects if they don't exist.
-- No destructive statements. All policies prefixed with reg_.

-- Create private resumes bucket only if it doesn't exist
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
select 'resumes', 'resumes', false, 5242880, array['application/pdf']
where not exists (select 1 from storage.buckets where id = 'resumes');

-- Storage policies for resumes bucket (all prefixed with reg_)

-- Users can upload to their own folder
drop policy if exists "reg_users_upload_own_resumes" on storage.objects;
create policy "reg_users_upload_own_resumes"
  on storage.objects for insert
  with check (
    bucket_id = 'resumes'
    and auth.uid()::text = (storage.foldername(name))[1]
  );

-- Users can update their own files
drop policy if exists "reg_users_update_own_resumes" on storage.objects;
create policy "reg_users_update_own_resumes"
  on storage.objects for update
  using (
    bucket_id = 'resumes'
    and auth.uid()::text = (storage.foldername(name))[1]
  );

-- Users can read their own files
drop policy if exists "reg_users_read_own_resumes" on storage.objects;
create policy "reg_users_read_own_resumes"
  on storage.objects for select
  using (
    bucket_id = 'resumes'
    and auth.uid()::text = (storage.foldername(name))[1]
  );

-- Users can delete their own files
drop policy if exists "reg_users_delete_own_resumes" on storage.objects;
create policy "reg_users_delete_own_resumes"
  on storage.objects for delete
  using (
    bucket_id = 'resumes'
    and auth.uid()::text = (storage.foldername(name))[1]
  );

-- Admins can read all resumes
drop policy if exists "reg_admins_read_all_resumes" on storage.objects;
create policy "reg_admins_read_all_resumes"
  on storage.objects for select
  using (
    bucket_id = 'resumes'
    and public.reg_is_admin()
  );
