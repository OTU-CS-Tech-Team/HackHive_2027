-- Optional preferred name (printed as the nickname on the indemnification
-- form) and a required agreement that electronic signatures are binding.
alter table public.applications
  add column preferred_name text check (length(preferred_name) <= 100),
  add column consent_esignature boolean;

drop function public.reg_submit_application(text, text, text, text, int, text, text, text, text, text, text, date, int, text, text, text, text, text, text, text, text, text[], text, text, text, boolean, text, text, text, text, text, boolean, boolean, boolean, boolean, boolean, text, timestamptz, text, uuid, text[]);

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
  p_consent_indemnification boolean,
  p_indemnification_path text,
  p_stamped_at timestamptz,
  p_email text,
  p_user_id uuid,
  p_other_links text[] default null,
  p_preferred_name text default null,
  p_consent_esignature boolean default null
)
returns jsonb
language plpgsql
security definer
as $$
declare
  v_app_id uuid;
  v_submitted_at timestamptz;
  v_existing record;
begin
  if not (
    select coalesce(applications_open, true) and (deadline is null or deadline > now())
    from public.reg_settings where id = 1
  ) then
    return jsonb_build_object('error', 'applications_closed');
  end if;

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

  if p_consent_indemnification is not true
     or p_indemnification_path is null
     or p_indemnification_path not like p_user_id::text || '/%' then
    return jsonb_build_object('error', 'indemnification_required');
  end if;

  if p_consent_esignature is not true then
    return jsonb_build_object('error', 'esignature_required');
  end if;

  insert into public.applications (
    user_id, email, status, submitted_at, submission_id,
    first_name, last_name, preferred_name, phone, age, pronouns, city, country,
    university, program, year_of_study, grad_date, hackathons_count,
    linkedin_url, github_url, portfolio_url, other_links, resume_path,
    q_proud, q_hack, q_anything_else, team_status, teammate_emails,
    dietary, accessibility, tshirt_size, needs_travel_help, gender, ethnicity,
    guardian_name, guardian_phone, guardian_relationship,
    consent_coc, consent_privacy, consent_photo, share_resume_with_sponsors,
    consent_indemnification, indemnification_path, consent_esignature
  )
  values (
    p_user_id, lower(p_email), 'submitted', p_stamped_at, p_submission_id,
    p_first_name, p_last_name, p_preferred_name, p_phone, p_age, p_pronouns, p_city, p_country,
    p_university, p_program, p_year_of_study, p_grad_date, p_hackathons_count,
    p_linkedin_url, p_github_url, p_portfolio_url, p_other_links, p_resume_path,
    p_q_proud, p_q_hack, p_q_anything_else, p_team_status, p_teammate_emails,
    p_dietary, p_accessibility, p_tshirt_size, p_needs_travel_help, p_gender, p_ethnicity,
    p_guardian_name, p_guardian_phone, p_guardian_relationship,
    p_consent_coc, p_consent_privacy, p_consent_photo, p_share_resume_with_sponsors,
    p_consent_indemnification, p_indemnification_path, p_consent_esignature
  )
  on conflict (user_id) do update set
    status = excluded.status,
    submitted_at = excluded.submitted_at,
    submission_id = excluded.submission_id,
    first_name = excluded.first_name,
    last_name = excluded.last_name,
    preferred_name = excluded.preferred_name,
    phone = excluded.phone,
    age = excluded.age,
    pronouns = excluded.pronouns,
    city = excluded.city,
    country = excluded.country,
    university = excluded.university,
    program = excluded.program,
    year_of_study = excluded.year_of_study,
    grad_date = excluded.grad_date,
    hackathons_count = excluded.hackathons_count,
    linkedin_url = excluded.linkedin_url,
    github_url = excluded.github_url,
    portfolio_url = excluded.portfolio_url,
    other_links = excluded.other_links,
    resume_path = excluded.resume_path,
    q_proud = excluded.q_proud,
    q_hack = excluded.q_hack,
    q_anything_else = excluded.q_anything_else,
    team_status = excluded.team_status,
    teammate_emails = excluded.teammate_emails,
    dietary = excluded.dietary,
    accessibility = excluded.accessibility,
    tshirt_size = excluded.tshirt_size,
    needs_travel_help = excluded.needs_travel_help,
    gender = excluded.gender,
    ethnicity = excluded.ethnicity,
    guardian_name = excluded.guardian_name,
    guardian_phone = excluded.guardian_phone,
    guardian_relationship = excluded.guardian_relationship,
    consent_coc = excluded.consent_coc,
    consent_privacy = excluded.consent_privacy,
    consent_photo = excluded.consent_photo,
    share_resume_with_sponsors = excluded.share_resume_with_sponsors,
    consent_indemnification = excluded.consent_indemnification,
    indemnification_path = excluded.indemnification_path,
    consent_esignature = excluded.consent_esignature
  where applications.status = 'draft'
  returning id, submitted_at into v_app_id, v_submitted_at;

  if v_app_id is null then
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
    return jsonb_build_object('error', 'already_submitted');
  end if;

  return jsonb_build_object(
    'ok', true,
    'application_id', v_app_id,
    'submitted_at', v_submitted_at
  );
end;
$$;

revoke all on function public.reg_submit_application(text, text, text, text, int, text, text, text, text, text, text, date, int, text, text, text, text, text, text, text, text, text[], text, text, text, boolean, text, text, text, text, text, boolean, boolean, boolean, boolean, boolean, text, timestamptz, text, uuid, text[], text, boolean) from public, anon, authenticated;
grant execute on function public.reg_submit_application(text, text, text, text, int, text, text, text, text, text, text, date, int, text, text, text, text, text, text, text, text, text[], text, text, text, boolean, text, text, text, text, text, boolean, boolean, boolean, boolean, boolean, text, timestamptz, text, uuid, text[], text, boolean) to service_role;
