-- HackHive 2027 Registration Backend Schema
-- Migration 2: Storage bucket for resumes

-- Create private resumes bucket
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'resumes',
  'resumes',
  false,
  5242880, -- 5MB in bytes
  array['application/pdf']
);

-- Storage policies for resumes bucket

-- Users can upload to their own folder
create policy "Users can upload own resumes"
  on storage.objects for insert
  with check (
    bucket_id = 'resumes'
    and auth.uid()::text = (storage.foldername(name))[1]
  );

-- Users can update their own files
create policy "Users can update own resumes"
  on storage.objects for update
  using (
    bucket_id = 'resumes'
    and auth.uid()::text = (storage.foldername(name))[1]
  );

-- Users can read their own files
create policy "Users can read own resumes"
  on storage.objects for select
  using (
    bucket_id = 'resumes'
    and auth.uid()::text = (storage.foldername(name))[1]
  );

-- Users can delete their own files
create policy "Users can delete own resumes"
  on storage.objects for delete
  using (
    bucket_id = 'resumes'
    and auth.uid()::text = (storage.foldername(name))[1]
  );

-- Admins can read all resumes
create policy "Admins can read all resumes"
  on storage.objects for select
  using (
    bucket_id = 'resumes'
    and public.is_admin()
  );
