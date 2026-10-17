'use server';

import { headers } from 'next/headers';
import { createClient, createServiceClient } from '@/lib/supabase/server';
import { getVerifiedUser } from '@/lib/auth/helpers';
import {
  applicationDraftSchema,
  applicationSubmitSchema,
  type ApplicationDraft,
  type SaveDraftResult,
  type CreateResumeUploadResult,
  type SubmitApplicationResult,
  type GetMyApplicationResult,
  type Application,
} from '@/lib/applications/schema';
import crypto from 'crypto';

const MIN_SUBMIT_TIME_MS = 3000;
const RATE_LIMIT_WINDOW_SECONDS = 3600;
const RATE_LIMIT_MAX_ATTEMPTS = 5;

function hashKey(key: string): string {
  const secret = process.env.RATE_LIMIT_HASH_SECRET;
  if (!secret) {
    throw new Error('RATE_LIMIT_HASH_SECRET is not configured');
  }
  return crypto.createHmac('sha256', secret).update(key).digest('hex');
}

async function getClientIp(): Promise<string> {
  const headersList = await headers();
  const forwardedFor = headersList.get('x-forwarded-for');
  const realIp = headersList.get('x-real-ip');
  
  if (forwardedFor) {
    return forwardedFor.split(',')[0].trim();
  }
  if (realIp) {
    return realIp;
  }
  return 'unknown';
}

async function verifyTurnstile(token: string, ip: string): Promise<boolean> {
  const secret = process.env.TURNSTILE_SECRET_KEY;
  if (!secret) {
    console.error('TURNSTILE_SECRET_KEY is not configured');
    return false;
  }

  if (secret === '1x0000000000000000000000000000000AA') {
    return true;
  }

  try {
    const response = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        secret,
        response: token,
        remoteip: ip,
      }),
    });

    const data = await response.json() as { success: boolean };
    return data.success;
  } catch (error) {
    console.error('Turnstile verification failed:', error);
    return false;
  }
}

async function checkRateLimit(ipHash: string, emailHash: string): Promise<boolean> {
  const serviceClient = await createServiceClient();
  
  const { data: ipOk } = await serviceClient.rpc('check_rate_limit', {
    p_key_hash: `ip:${ipHash}`,
    p_window_seconds: RATE_LIMIT_WINDOW_SECONDS,
    p_max_attempts: RATE_LIMIT_MAX_ATTEMPTS,
  });
  
  if (ipOk === false) {
    return false;
  }
  
  const { data: emailOk } = await serviceClient.rpc('check_rate_limit', {
    p_key_hash: `email:${emailHash}`,
    p_window_seconds: RATE_LIMIT_WINDOW_SECONDS,
    p_max_attempts: RATE_LIMIT_MAX_ATTEMPTS,
  });
  
  return emailOk !== false;
}

async function checkDeadlineAndOpen(): Promise<boolean> {
  const supabase = await createClient();
  
  const { data } = await supabase.rpc('can_submit_application');
  return data === true;
}

export async function saveDraft(fields: Partial<ApplicationDraft>): Promise<SaveDraftResult> {
  try {
    const user = await getVerifiedUser();
    
    if (!user) {
      return { ok: false, code: 'not_verified', error: 'Email not verified' };
    }

    const result = applicationDraftSchema.partial().safeParse(fields);
    
    if (!result.success) {
      const fieldErrors: Record<string, string[]> = {};
      for (const issue of result.error.issues) {
        const path = issue.path.join('.');
        if (!fieldErrors[path]) {
          fieldErrors[path] = [];
        }
        fieldErrors[path].push(issue.message);
      }
      return { ok: false, code: 'validation', error: 'Validation failed', fieldErrors };
    }

    const canSubmit = await checkDeadlineAndOpen();
    if (!canSubmit) {
      return { ok: false, code: 'locked', error: 'Applications are closed or past deadline' };
    }

    const supabase = await createClient();

    const { data: existing } = await supabase
      .from('applications')
      .select('id, status')
      .eq('user_id', user.id)
      .single();

    if (existing?.status === 'submitted') {
      return { ok: false, code: 'already_submitted', error: 'Application already submitted' };
    }

    const updateData: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(result.data)) {
      if (value !== undefined) {
        updateData[key] = value === '' ? null : value;
      }
    }

    if (existing) {
      const { error } = await supabase
        .from('applications')
        .update(updateData)
        .eq('user_id', user.id)
        .eq('status', 'draft');

      if (error) {
        console.error('Draft update error:', error);
        return { ok: false, code: 'server', error: 'Failed to save draft' };
      }
    } else {
      const { error } = await supabase
        .from('applications')
        .insert({
          user_id: user.id,
          email: user.email.toLowerCase(),
          ...updateData,
        });

      if (error) {
        console.error('Draft insert error:', error);
        return { ok: false, code: 'server', error: 'Failed to create draft' };
      }
    }

    return { ok: true, savedAt: new Date().toISOString() };
  } catch (error) {
    console.error('saveDraft error:', error);
    return { ok: false, code: 'server', error: 'An unexpected error occurred' };
  }
}

export async function createResumeUpload(): Promise<CreateResumeUploadResult> {
  try {
    const user = await getVerifiedUser();
    
    if (!user) {
      return { ok: false, code: 'not_verified', error: 'Email not verified' };
    }

    const supabase = await createClient();
    
    const uuid = crypto.randomUUID();
    const path = `${user.id}/resume-${uuid}.pdf`;

    const { data, error } = await supabase.storage
      .from('resumes')
      .createSignedUploadUrl(path);

    if (error || !data) {
      console.error('Storage upload URL error:', error);
      return { ok: false, code: 'server', error: 'Failed to create upload URL' };
    }

    return {
      ok: true,
      path,
      signedUrl: data.signedUrl,
      token: data.token,
    };
  } catch (error) {
    console.error('createResumeUpload error:', error);
    return { ok: false, code: 'server', error: 'An unexpected error occurred' };
  }
}

async function verifyResumeExists(supabase: Awaited<ReturnType<typeof createClient>>, path: string): Promise<{ exists: boolean; error?: string }> {
  const { data, error } = await supabase.storage
    .from('resumes')
    .list(path.split('/')[0], {
      search: path.split('/')[1],
    });

  if (error) {
    console.error('Resume check error:', error);
    return { exists: false, error: 'Failed to verify resume' };
  }

  const fileName = path.split('/')[1];
  const file = data?.find(f => f.name === fileName);
  
  if (!file) {
    return { exists: false, error: 'Resume file not found. Please upload your resume first.' };
  }

  if (file.metadata?.mimetype && file.metadata.mimetype !== 'application/pdf') {
    return { exists: false, error: 'Resume must be a PDF file' };
  }

  const sizeLimit = 5 * 1024 * 1024;
  if (file.metadata?.size && Number(file.metadata.size) > sizeLimit) {
    return { exists: false, error: 'Resume must be 5MB or less' };
  }

  return { exists: true };
}

export async function submitApplication(input: {
  fields: Record<string, unknown>;
  turnstileToken: string;
  startedAt: number;
  website?: string;
  idempotencyKey: string;
}): Promise<SubmitApplicationResult> {
  try {
    const user = await getVerifiedUser();
    
    if (!user) {
      return { ok: false, code: 'not_verified', error: 'Email not verified' };
    }

    if (input.website && input.website.trim() !== '') {
      return { ok: false, code: 'validation', error: 'Invalid submission' };
    }

    const elapsed = Date.now() - input.startedAt;
    if (elapsed < MIN_SUBMIT_TIME_MS) {
      return { ok: false, code: 'too_fast', error: 'Please take more time to fill out the form' };
    }

    const clientIp = await getClientIp();
    const ipHash = hashKey(clientIp);
    const emailHash = hashKey(user.email.toLowerCase());
    
    const withinLimit = await checkRateLimit(ipHash, emailHash);
    if (!withinLimit) {
      return { ok: false, code: 'rate_limited', error: 'Too many submission attempts. Please try again later.' };
    }

    const turnstileValid = await verifyTurnstile(input.turnstileToken, clientIp);
    if (!turnstileValid) {
      return { ok: false, code: 'turnstile', error: 'Captcha verification failed. Please try again.' };
    }

    const canSubmit = await checkDeadlineAndOpen();
    if (!canSubmit) {
      return { ok: false, code: 'locked', error: 'Applications are closed or past deadline' };
    }

    const result = applicationSubmitSchema.safeParse(input.fields);
    
    if (!result.success) {
      const fieldErrors: Record<string, string[]> = {};
      for (const issue of result.error.issues) {
        const path = issue.path.join('.');
        if (!fieldErrors[path]) {
          fieldErrors[path] = [];
        }
        fieldErrors[path].push(issue.message);
      }
      return { ok: false, code: 'validation', error: 'Validation failed', fieldErrors };
    }

    const data = result.data;

    if (!data.resume_path.startsWith(`${user.id}/`)) {
      return { 
        ok: false, 
        code: 'validation', 
        error: 'Invalid resume path',
        fieldErrors: { resume_path: ['Invalid resume path'] }
      };
    }

    const supabase = await createClient();

    const resumeCheck = await verifyResumeExists(supabase, data.resume_path);
    if (!resumeCheck.exists) {
      return {
        ok: false,
        code: 'validation',
        error: resumeCheck.error || 'Resume not found',
        fieldErrors: { resume_path: [resumeCheck.error || 'Resume not found'] }
      };
    }

    const { data: rpcResult, error: rpcError } = await supabase.rpc('submit_application', {
      p_idempotency_key: input.idempotencyKey,
      p_first_name: data.first_name,
      p_last_name: data.last_name,
      p_phone: data.phone,
      p_age: data.age,
      p_pronouns: data.pronouns || null,
      p_city: data.city,
      p_country: data.country,
      p_university: data.university,
      p_program: data.program,
      p_year_of_study: data.year_of_study,
      p_grad_date: data.grad_date?.toISOString().split('T')[0] || null,
      p_hackathons_count: data.hackathons_count ?? null,
      p_linkedin_url: data.linkedin_url || null,
      p_github_url: data.github_url || null,
      p_portfolio_url: data.portfolio_url || null,
      p_resume_path: data.resume_path,
      p_q_proud: data.q_proud,
      p_q_hack: data.q_hack,
      p_q_extra: data.q_extra || null,
      p_team_status: data.team_status,
      p_teammate_emails: data.teammate_emails || null,
      p_dietary: data.dietary || null,
      p_accessibility: data.accessibility || null,
      p_tshirt_size: data.tshirt_size,
      p_needs_travel_help: data.needs_travel_help ?? null,
      p_gender: data.gender || null,
      p_ethnicity: data.ethnicity || null,
      p_guardian_name: data.guardian_name || null,
      p_guardian_phone: data.guardian_phone || null,
      p_consent_coc: data.consent_coc,
      p_consent_privacy: data.consent_privacy,
      p_consent_photo: data.consent_photo ?? null,
      p_share_resume_sponsors: data.share_resume_sponsors ?? null,
    });

    if (rpcError) {
      console.error('Submit RPC error:', rpcError);
      return { ok: false, code: 'server', error: 'Failed to submit application' };
    }

    const response = rpcResult as { ok?: boolean; error?: string; application_id?: string; submitted_at?: string };

    if (response.error) {
      if (response.error === 'already_submitted') {
        return { ok: false, code: 'already_submitted', error: 'Application already submitted' };
      }
      if (response.error === 'applications_closed') {
        return { ok: false, code: 'locked', error: 'Applications are closed' };
      }
      if (response.error === 'no_draft_found') {
        return { ok: false, code: 'server', error: 'No draft application found. Please save a draft first.' };
      }
      return { ok: false, code: 'server', error: response.error };
    }

    if (response.ok && response.application_id) {
      return {
        ok: true,
        applicationId: response.application_id,
        submittedAt: response.submitted_at || new Date().toISOString(),
      };
    }

    return { ok: false, code: 'server', error: 'Unexpected response from server' };
  } catch (error) {
    console.error('submitApplication error:', error);
    return { ok: false, code: 'server', error: 'An unexpected error occurred' };
  }
}

export async function getMyApplication(): Promise<GetMyApplicationResult> {
  try {
    const user = await getVerifiedUser();
    
    if (!user) {
      return { ok: false, code: 'not_verified', error: 'Email not verified' };
    }

    const supabase = await createClient();

    const { data, error } = await supabase
      .from('applications')
      .select('*')
      .eq('user_id', user.id)
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        return { ok: true, application: null };
      }
      console.error('getMyApplication error:', error);
      return { ok: false, code: 'server', error: 'Failed to fetch application' };
    }

    return { ok: true, application: data as Application };
  } catch (error) {
    console.error('getMyApplication error:', error);
    return { ok: false, code: 'server', error: 'An unexpected error occurred' };
  }
}
