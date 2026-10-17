-- HackHive 2027 Registration Backend Schema
-- Migration 1: Initial schema setup

-- Enable required extensions
create extension if not exists "pgcrypto";

-- App settings table (single row for global configuration)
create table public.app_settings (
  id int primary key default 1 check (id = 1),
  applications_open boolean not null default true,
  deadline timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Insert default settings row
insert into public.app_settings (id) values (1);

-- Admins table
create table public.admins (
  user_id uuid primary key references auth.users on delete cascade,
  created_at timestamptz not null default now()
);

-- Security definer function to check if current user is admin
create or replace function public.is_admin()
returns boolean
language sql
security definer
stable
as $$
  select exists (
    select 1 from public.admins where user_id = auth.uid()
  );
$$;

-- Applications table with all required fields and constraints
create table public.applications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid unique not null references auth.users on delete cascade,
  email text unique not null,
  status text not null default 'draft' check (status in ('draft', 'submitted')),
  submitted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  idempotency_key text unique,
  
  -- Personal info
  first_name text check (length(first_name) <= 100),
  last_name text check (length(last_name) <= 100),
  phone text check (length(phone) <= 30),
  age int check (age is null or (age >= 13 and age <= 100)),
  pronouns text check (length(pronouns) <= 50),
  city text check (length(city) <= 100),
  country text check (length(country) <= 100),
  
  -- Education
  university text check (length(university) <= 200),
  program text check (length(program) <= 200),
  year_of_study text check (length(year_of_study) <= 50),
  grad_date date,
  hackathons_count int check (hackathons_count is null or hackathons_count >= 0),
  
  -- Links
  linkedin_url text check (length(linkedin_url) <= 500),
  github_url text check (length(github_url) <= 500),
  portfolio_url text check (length(portfolio_url) <= 500),
  resume_path text check (length(resume_path) <= 500),
  
  -- Questions
  q_proud text check (length(q_proud) <= 2000),
  q_hack text check (length(q_hack) <= 2000),
  q_extra text check (length(q_extra) <= 2000),
  
  -- Team
  team_status text check (team_status is null or team_status in ('solo', 'has_team', 'looking')),
  teammate_emails text[] check (cardinality(teammate_emails) <= 3),
  
  -- Logistics
  dietary text check (length(dietary) <= 500),
  accessibility text check (length(accessibility) <= 1000),
  tshirt_size text check (length(tshirt_size) <= 20),
  needs_travel_help boolean,
  
  -- Demographics (optional)
  gender text check (length(gender) <= 50),
  ethnicity text check (length(ethnicity) <= 100),
  
  -- Guardian (required if under 18)
  guardian_name text check (length(guardian_name) <= 200),
  guardian_phone text check (length(guardian_phone) <= 30),
  
  -- Consents
  consent_coc boolean,
  consent_privacy boolean,
  consent_photo boolean,
  share_resume_sponsors boolean default false,
  
  -- Email must be lowercase
  constraint email_lowercase check (email = lower(email))
);

-- Function to update updated_at timestamp
create or replace function public.update_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- Trigger for applications updated_at
create trigger applications_updated_at
  before update on public.applications
  for each row
  execute function public.update_updated_at();

-- Trigger for app_settings updated_at
create trigger app_settings_updated_at
  before update on public.app_settings
  for each row
  execute function public.update_updated_at();

-- Rate limiting table (keyed by SHA-256 hash of IP or email)
create table public.application_rate_limits (
  key_hash text primary key,
  count int not null default 1,
  window_start timestamptz not null default now(),
  created_at timestamptz not null default now()
);

-- Atomic check-and-increment function for rate limiting
-- Returns true if within limit, false if exceeded
create or replace function public.check_rate_limit(
  p_key_hash text,
  p_window_seconds int default 3600,
  p_max_attempts int default 5
)
returns boolean
language plpgsql
security definer
as $$
declare
  v_now timestamptz := now();
  v_window_start timestamptz := v_now - (p_window_seconds || ' seconds')::interval;
  v_count int;
begin
  -- Insert or update atomically using ON CONFLICT
  insert into public.application_rate_limits (key_hash, count, window_start)
  values (p_key_hash, 1, v_now)
  on conflict (key_hash) do update
  set
    count = case
      when application_rate_limits.window_start < v_window_start then 1
      else application_rate_limits.count + 1
    end,
    window_start = case
      when application_rate_limits.window_start < v_window_start then v_now
      else application_rate_limits.window_start
    end
  returning count into v_count;
  
  return v_count <= p_max_attempts;
end;
$$;

-- Cleanup function for old rate limit entries
create or replace function public.cleanup_rate_limits(p_older_than_hours int default 24)
returns int
language plpgsql
security definer
as $$
declare
  v_deleted int;
begin
  delete from public.application_rate_limits
  where window_start < now() - (p_older_than_hours || ' hours')::interval;
  
  get diagnostics v_deleted = row_count;
  return v_deleted;
end;
$$;

-- Function to get deadline and open status
create or replace function public.get_application_settings()
returns table(applications_open boolean, deadline timestamptz)
language sql
security definer
stable
as $$
  select applications_open, deadline from public.app_settings where id = 1;
$$;

-- Function to check if applications are currently accepting submissions
create or replace function public.can_submit_application()
returns boolean
language sql
security definer
stable
as $$
  select 
    coalesce(applications_open, true) 
    and (deadline is null or deadline > now())
  from public.app_settings 
  where id = 1;
$$;

-- RPC function for atomic submit (prevents race conditions)
create or replace function public.submit_application(
  p_idempotency_key text,
  p_first_name text,
  p_last_name text,
  p_phone text,
  p_age int,
  p_pronouns text,
  p_city text,
  p_country text,
  p_university text,
  p_program text,
  p_year_of_study text,
  p_grad_date date,
  p_hackathons_count int,
  p_linkedin_url text,
  p_github_url text,
  p_portfolio_url text,
  p_resume_path text,
  p_q_proud text,
  p_q_hack text,
  p_q_extra text,
  p_team_status text,
  p_teammate_emails text[],
  p_dietary text,
  p_accessibility text,
  p_tshirt_size text,
  p_needs_travel_help boolean,
  p_gender text,
  p_ethnicity text,
  p_guardian_name text,
  p_guardian_phone text,
  p_consent_coc boolean,
  p_consent_privacy boolean,
  p_consent_photo boolean,
  p_share_resume_sponsors boolean
)
returns jsonb
language plpgsql
security definer
as $$
declare
  v_user_id uuid := auth.uid();
  v_now timestamptz := now();
  v_result jsonb;
  v_app_id uuid;
  v_submitted_at timestamptz;
  v_existing record;
begin
  if v_user_id is null then
    return jsonb_build_object('error', 'not_authenticated');
  end if;
  
  -- Check if applications are open and before deadline
  if not public.can_submit_application() then
    return jsonb_build_object('error', 'applications_closed');
  end if;
  
  -- Check for existing row with same idempotency key (return original success)
  select id, submitted_at into v_existing
  from public.applications
  where idempotency_key = p_idempotency_key and user_id = v_user_id;
  
  if found and v_existing.submitted_at is not null then
    return jsonb_build_object(
      'ok', true,
      'application_id', v_existing.id,
      'submitted_at', v_existing.submitted_at
    );
  end if;
  
  -- Check if already submitted (different idempotency key but same user)
  select id, submitted_at into v_existing
  from public.applications
  where user_id = v_user_id and status = 'submitted';
  
  if found then
    return jsonb_build_object('error', 'already_submitted');
  end if;
  
  -- Atomic update with conditional WHERE clause
  update public.applications
  set
    status = 'submitted',
    submitted_at = v_now,
    idempotency_key = p_idempotency_key,
    first_name = p_first_name,
    last_name = p_last_name,
    phone = p_phone,
    age = p_age,
    pronouns = p_pronouns,
    city = p_city,
    country = p_country,
    university = p_university,
    program = p_program,
    year_of_study = p_year_of_study,
    grad_date = p_grad_date,
    hackathons_count = p_hackathons_count,
    linkedin_url = p_linkedin_url,
    github_url = p_github_url,
    portfolio_url = p_portfolio_url,
    resume_path = p_resume_path,
    q_proud = p_q_proud,
    q_hack = p_q_hack,
    q_extra = p_q_extra,
    team_status = p_team_status,
    teammate_emails = p_teammate_emails,
    dietary = p_dietary,
    accessibility = p_accessibility,
    tshirt_size = p_tshirt_size,
    needs_travel_help = p_needs_travel_help,
    gender = p_gender,
    ethnicity = p_ethnicity,
    guardian_name = p_guardian_name,
    guardian_phone = p_guardian_phone,
    consent_coc = p_consent_coc,
    consent_privacy = p_consent_privacy,
    consent_photo = p_consent_photo,
    share_resume_sponsors = p_share_resume_sponsors
  where user_id = v_user_id and status = 'draft'
  returning id, submitted_at into v_app_id, v_submitted_at;
  
  if v_app_id is null then
    -- No draft found - either doesn't exist or already submitted
    return jsonb_build_object('error', 'no_draft_found');
  end if;
  
  return jsonb_build_object(
    'ok', true,
    'application_id', v_app_id,
    'submitted_at', v_submitted_at
  );
end;
$$;

-- Enable RLS on all tables
alter table public.applications enable row level security;
alter table public.admins enable row level security;
alter table public.app_settings enable row level security;
alter table public.application_rate_limits enable row level security;

-- RLS Policies for applications

-- Applicants can view their own row
create policy "Users can view own application"
  on public.applications for select
  using (auth.uid() = user_id);

-- Applicants can insert their own row
create policy "Users can insert own application"
  on public.applications for insert
  with check (auth.uid() = user_id);

-- Applicants can update their own row ONLY while draft and before deadline
-- Note: They cannot update status, submitted_at, user_id, or email directly
create policy "Users can update own draft application"
  on public.applications for update
  using (
    auth.uid() = user_id 
    and status = 'draft'
    and public.can_submit_application()
  )
  with check (
    auth.uid() = user_id
    and status = 'draft'
  );

-- Admins can view all applications
create policy "Admins can view all applications"
  on public.applications for select
  using (public.is_admin());

-- No delete policy for applicants (they cannot delete)

-- RLS Policies for admins table
create policy "Admins can view admins"
  on public.admins for select
  using (public.is_admin());

-- RLS Policies for app_settings
create policy "Anyone can view app_settings"
  on public.app_settings for select
  using (true);

create policy "Admins can update app_settings"
  on public.app_settings for update
  using (public.is_admin());

-- RLS Policies for rate_limits (not readable by clients)
-- No select/insert/update/delete policies for regular users
create policy "Service role only for rate_limits"
  on public.application_rate_limits for all
  using (false);

-- Grant execute on functions
grant execute on function public.is_admin() to authenticated;
grant execute on function public.get_application_settings() to anon, authenticated;
grant execute on function public.can_submit_application() to authenticated;
grant execute on function public.submit_application(text, text, text, text, int, text, text, text, text, text, text, date, int, text, text, text, text, text, text, text, text, text[], text, text, text, boolean, text, text, text, text, boolean, boolean, boolean, boolean) to authenticated;

-- Index for faster lookups
create index idx_applications_user_id on public.applications(user_id);
create index idx_applications_status on public.applications(status);
create index idx_applications_idempotency_key on public.applications(idempotency_key) where idempotency_key is not null;
create index idx_rate_limits_window on public.application_rate_limits(window_start);
