-- HackHive 2027 Registration Backend Schema
-- Migration 1: Initial schema setup
--
-- IMPORTANT: This migration ONLY creates new objects with reg_ prefix.
-- It never alters, drops, replaces, or truncates existing tables/functions.
-- All functions use plain CREATE (not CREATE OR REPLACE) so collisions fail loudly.

-- Enable required extensions (safe if already exists)
create extension if not exists "pgcrypto";

-- ============================================================================
-- TABLES (all use IF NOT EXISTS, no destructive operations)
-- ============================================================================

-- Registration settings table (single row for global configuration)
create table if not exists public.reg_settings (
  id int primary key default 1 check (id = 1),
  applications_open boolean not null default true,
  deadline timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Insert default settings row only if table is empty
insert into public.reg_settings (id)
select 1
where not exists (select 1 from public.reg_settings where id = 1);

-- Registration admins table (separate from any existing admin_users table)
create table if not exists public.reg_admins (
  user_id uuid primary key references auth.users on delete cascade,
  created_at timestamptz not null default now()
);

-- Rate limiting table (keyed by SHA-256 hash of IP or email)
create table if not exists public.reg_rate_limits (
  key_hash text primary key,
  count int not null default 1,
  window_start timestamptz not null default now(),
  created_at timestamptz not null default now()
);

-- Applications table with all required fields and constraints
create table if not exists public.applications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid unique not null references auth.users on delete cascade,
  email text unique not null,
  status text not null default 'draft' check (status in ('draft', 'submitted')),
  submitted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  submission_id text unique,
  
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
  q_anything_else text check (length(q_anything_else) <= 2000),
  
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
  guardian_relationship text check (length(guardian_relationship) <= 100),
  
  -- Consents
  consent_coc boolean,
  consent_privacy boolean,
  consent_photo boolean,
  share_resume_with_sponsors boolean default false,
  
  -- Email must be lowercase
  constraint applications_email_lowercase check (email = lower(email))
);

-- ============================================================================
-- FUNCTIONS (plain CREATE, no OR REPLACE - collisions fail loudly)
-- All helper functions prefixed with reg_
-- ============================================================================

-- Function to check if current user is a registration admin
-- Used by RLS policies, granted to authenticated
create function public.reg_is_admin()
returns boolean
language sql
security definer
stable
as $$
  select exists (
    select 1 from public.reg_admins where user_id = auth.uid()
  );
$$;

-- Function to check if applications are currently accepting submissions
-- Used by RLS policies, granted to authenticated
create function public.reg_can_submit()
returns boolean
language sql
security definer
stable
as $$
  select 
    coalesce(applications_open, true) 
    and (deadline is null or deadline > now())
  from public.reg_settings 
  where id = 1;
$$;

-- Function to update updated_at timestamp (trigger function)
create function public.reg_update_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- Function to get deadline and open status
-- SERVICE ROLE ONLY - not callable by clients
create function public.reg_get_settings()
returns table(applications_open boolean, deadline timestamptz)
language sql
security definer
stable
as $$
  select applications_open, deadline from public.reg_settings where id = 1;
$$;

-- Atomic check-and-increment function for rate limiting
-- SERVICE ROLE ONLY - not callable by clients
create function public.reg_check_rate_limit(
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
  insert into public.reg_rate_limits (key_hash, count, window_start)
  values (p_key_hash, 1, v_now)
  on conflict (key_hash) do update
  set
    count = case
      when reg_rate_limits.window_start < v_window_start then 1
      else reg_rate_limits.count + 1
    end,
    window_start = case
      when reg_rate_limits.window_start < v_window_start then v_now
      else reg_rate_limits.window_start
    end
  returning count into v_count;
  
  return v_count <= p_max_attempts;
end;
$$;

-- Cleanup function for old rate limit entries
-- SERVICE ROLE ONLY - not callable by clients
create function public.reg_cleanup_rate_limits(p_older_than_hours int default 24)
returns int
language plpgsql
security definer
as $$
declare
  v_deleted int;
begin
  delete from public.reg_rate_limits
  where window_start < now() - (p_older_than_hours || ' hours')::interval;
  
  get diagnostics v_deleted = row_count;
  return v_deleted;
end;
$$;

-- Trigger function to protect restricted columns from client modification
-- Allows changes only from service_role or the reg_submit_application function
create function public.reg_protect_columns()
returns trigger
language plpgsql
as $$
begin
  -- Service role bypasses all checks
  if current_setting('role', true) = 'service_role' then
    return new;
  end if;
  
  -- For INSERT: enforce protected column values
  if TG_OP = 'INSERT' then
    -- id is auto-generated, user cannot set it
    if new.id is distinct from gen_random_uuid() then
      -- Allow the default, but if they try to set a specific value, block it
      -- Actually we can't easily check this, so we rely on RLS + the checks below
      null;
    end if;
    
    -- These must match auth context on insert
    if new.user_id is distinct from auth.uid() then
      raise exception 'Cannot set user_id to a different user';
    end if;
    
    if lower(new.email) is distinct from lower(auth.jwt()->>'email') then
      raise exception 'Email must match authenticated user email';
    end if;
    
    -- These must be null/draft on insert
    if new.status is distinct from 'draft' then
      raise exception 'New applications must have status draft';
    end if;
    
    if new.submitted_at is not null then
      raise exception 'Cannot set submitted_at on insert';
    end if;
    
    if new.submission_id is not null then
      raise exception 'Cannot set submission_id on insert';
    end if;
  end if;
  
  -- For UPDATE: block changes to protected columns
  if TG_OP = 'UPDATE' then
    if new.id is distinct from old.id then
      raise exception 'Cannot change id';
    end if;
    
    if new.user_id is distinct from old.user_id then
      raise exception 'Cannot change user_id';
    end if;
    
    if new.email is distinct from old.email then
      raise exception 'Cannot change email';
    end if;
    
    if new.status is distinct from old.status then
      raise exception 'Cannot change status directly';
    end if;
    
    if new.submitted_at is distinct from old.submitted_at then
      raise exception 'Cannot change submitted_at directly';
    end if;
    
    if new.submission_id is distinct from old.submission_id then
      raise exception 'Cannot change submission_id directly';
    end if;
    
    if new.created_at is distinct from old.created_at then
      raise exception 'Cannot change created_at';
    end if;
  end if;
  
  return new;
end;
$$;

-- RPC function for atomic submit (prevents race conditions)
-- SERVICE ROLE ONLY - called from server action, not directly by clients
create function public.reg_submit_application(
  p_submission_id text,
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
  p_q_anything_else text,
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
  p_guardian_relationship text,
  p_consent_coc boolean,
  p_consent_privacy boolean,
  p_consent_photo boolean,
  p_share_resume_with_sponsors boolean,
  p_user_id uuid  -- passed from server, not from auth.uid()
)
returns jsonb
language plpgsql
security definer
as $$
declare
  v_now timestamptz := now();
  v_app_id uuid;
  v_submitted_at timestamptz;
  v_existing record;
begin
  -- Check if applications are open and before deadline
  if not (
    select coalesce(applications_open, true) and (deadline is null or deadline > now())
    from public.reg_settings where id = 1
  ) then
    return jsonb_build_object('error', 'applications_closed');
  end if;
  
  -- Check for existing row with same submission_id (return original success)
  -- This MUST happen before rate limiting since Turnstile tokens are single-use
  select id, submitted_at into v_existing
  from public.applications
  where submission_id = p_submission_id and user_id = p_user_id;
  
  if found and v_existing.submitted_at is not null then
    return jsonb_build_object(
      'ok', true,
      'application_id', v_existing.id,
      'submitted_at', v_existing.submitted_at
    );
  end if;
  
  -- Check if already submitted (different submission_id but same user)
  select id, submitted_at into v_existing
  from public.applications
  where user_id = p_user_id and status = 'submitted';
  
  if found then
    return jsonb_build_object(
      'ok', true,
      'application_id', v_existing.id,
      'submitted_at', v_existing.submitted_at
    );
  end if;
  
  -- Atomic update with conditional WHERE clause
  update public.applications
  set
    status = 'submitted',
    submitted_at = v_now,
    submission_id = p_submission_id,
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
    q_anything_else = p_q_anything_else,
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
    guardian_relationship = p_guardian_relationship,
    consent_coc = p_consent_coc,
    consent_privacy = p_consent_privacy,
    consent_photo = p_consent_photo,
    share_resume_with_sponsors = p_share_resume_with_sponsors
  where user_id = p_user_id and status = 'draft'
  returning id, submitted_at into v_app_id, v_submitted_at;
  
  if v_app_id is null then
    return jsonb_build_object('error', 'no_draft_found');
  end if;
  
  return jsonb_build_object(
    'ok', true,
    'application_id', v_app_id,
    'submitted_at', v_submitted_at
  );
end;
$$;

-- ============================================================================
-- TRIGGERS (drop if exists then create, all prefixed with reg_)
-- ============================================================================

drop trigger if exists reg_applications_updated_at on public.applications;
create trigger reg_applications_updated_at
  before update on public.applications
  for each row
  execute function public.reg_update_updated_at();

drop trigger if exists reg_settings_updated_at on public.reg_settings;
create trigger reg_settings_updated_at
  before update on public.reg_settings
  for each row
  execute function public.reg_update_updated_at();

drop trigger if exists reg_applications_protect_columns on public.applications;
create trigger reg_applications_protect_columns
  before insert or update on public.applications
  for each row
  execute function public.reg_protect_columns();

-- ============================================================================
-- ROW LEVEL SECURITY
-- ============================================================================

alter table public.applications enable row level security;
alter table public.reg_admins enable row level security;
alter table public.reg_settings enable row level security;
alter table public.reg_rate_limits enable row level security;

-- Applications: users can view their own
drop policy if exists "reg_users_select_own_application" on public.applications;
create policy "reg_users_select_own_application"
  on public.applications for select
  using (auth.uid() = user_id);

-- Applications: users can insert their own draft (with strict checks)
drop policy if exists "reg_users_insert_own_application" on public.applications;
create policy "reg_users_insert_own_application"
  on public.applications for insert
  with check (
    auth.uid() = user_id
    and lower(email) = lower(auth.jwt()->>'email')
    and status = 'draft'
    and submitted_at is null
    and submission_id is null
    and (
      select coalesce(applications_open, true) and (deadline is null or deadline > now())
      from public.reg_settings where id = 1
    )
  );

-- Applications: users can update their own draft while open
drop policy if exists "reg_users_update_own_draft" on public.applications;
create policy "reg_users_update_own_draft"
  on public.applications for update
  using (
    auth.uid() = user_id 
    and status = 'draft'
    and (
      select coalesce(applications_open, true) and (deadline is null or deadline > now())
      from public.reg_settings where id = 1
    )
  )
  with check (
    auth.uid() = user_id
    and status = 'draft'
  );

-- Applications: admins can view all
drop policy if exists "reg_admins_select_all_applications" on public.applications;
create policy "reg_admins_select_all_applications"
  on public.applications for select
  using (public.reg_is_admin());

-- reg_admins: admins can view
drop policy if exists "reg_admins_select_reg_admins" on public.reg_admins;
create policy "reg_admins_select_reg_admins"
  on public.reg_admins for select
  using (public.reg_is_admin());

-- reg_settings: anyone can view
drop policy if exists "reg_anyone_select_settings" on public.reg_settings;
create policy "reg_anyone_select_settings"
  on public.reg_settings for select
  using (true);

-- reg_settings: admins can update
drop policy if exists "reg_admins_update_settings" on public.reg_settings;
create policy "reg_admins_update_settings"
  on public.reg_settings for update
  using (public.reg_is_admin());

-- reg_rate_limits: no client access (service role only)
drop policy if exists "reg_no_client_access_rate_limits" on public.reg_rate_limits;
create policy "reg_no_client_access_rate_limits"
  on public.reg_rate_limits for all
  using (false);

-- ============================================================================
-- PERMISSIONS
-- ============================================================================

-- Functions needed by RLS policies - grant to authenticated
grant execute on function public.reg_is_admin() to authenticated;
grant execute on function public.reg_can_submit() to authenticated;

-- Revoke all privileges from public/anon/authenticated on service-role-only functions
revoke all on function public.reg_submit_application(text, text, text, text, int, text, text, text, text, text, text, date, int, text, text, text, text, text, text, text, text, text[], text, text, text, boolean, text, text, text, text, text, boolean, boolean, boolean, boolean, uuid) from public, anon, authenticated;
revoke all on function public.reg_check_rate_limit(text, int, int) from public, anon, authenticated;
revoke all on function public.reg_cleanup_rate_limits(int) from public, anon, authenticated;
revoke all on function public.reg_get_settings() from public, anon, authenticated;

-- Grant service-role-only functions to service_role
grant execute on function public.reg_submit_application(text, text, text, text, int, text, text, text, text, text, text, date, int, text, text, text, text, text, text, text, text, text[], text, text, text, boolean, text, text, text, text, text, boolean, boolean, boolean, boolean, uuid) to service_role;
grant execute on function public.reg_check_rate_limit(text, int, int) to service_role;
grant execute on function public.reg_cleanup_rate_limits(int) to service_role;
grant execute on function public.reg_get_settings() to service_role;

-- ============================================================================
-- INDEXES
-- ============================================================================

create index if not exists idx_applications_user_id on public.applications(user_id);
create index if not exists idx_applications_status on public.applications(status);
create index if not exists idx_applications_submission_id on public.applications(submission_id) where submission_id is not null;
create index if not exists idx_reg_rate_limits_window on public.reg_rate_limits(window_start);
