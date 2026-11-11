'use server';

import { revalidatePath } from 'next/cache';
import { headers } from 'next/headers';
import { after } from 'next/server';
import { sendApplicationReceivedEmail } from '@/lib/email';
import { createClient, createServiceClient } from '@/lib/supabase/server';
import { getVerifiedUser } from '@/lib/auth/helpers';
import {
  applicationDraftSchema,
  applicationSubmitSchema,
  indemnificationPreviewSchema,
  type ApplicationDraft,
  type SaveDraftResult,
  type GetResumeUploadUrlResult,
  type SubmitApplicationResult,
  type PreviewIndemnificationResult,
  type GetMyApplicationResult,
  type Application,
} from '@/lib/application/schema';
import { previewFilledForm, type IndemnificationApplicant } from '@/lib/indemnification';
import crypto from 'crypto';
import { z } from 'zod';

const REQUIRED_SUBMIT_ENV = ['SUPABASE_SERVICE_ROLE_KEY', 'RATE_LIMIT_HASH_SECRET', 'TURNSTILE_SECRET_KEY'];
const MIN_SUBMIT_TIME_MS = 3000;
const RATE_LIMIT_WINDOW_SECONDS = 3600;
const RATE_LIMIT_IP_MAX_ATTEMPTS = 100;
const RATE_LIMIT_EMAIL_MAX_ATTEMPTS = 5;

function issuesToFieldErrors(issues: z.core.$ZodIssue[]): Record<string, string[]> {
  const fieldErrors: Record<string, string[]> = {};
  for (const issue of issues) {
    const path = issue.path.join('.');
    (fieldErrors[path] ??= []).push(issue.message);
  }
  return fieldErrors;
}

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

// Fails closed: if the check itself errors, the submit is refused rather than
// let through unlimited. (A database that can't run this can't save the submit either.)
async function checkRateLimits(ipHash: string, emailHash: string): Promise<{ allowed: boolean; limitType?: 'ip' | 'email' | 'error' }> {
  const serviceClient = createServiceClient();
  const limits = [
    { limitType: 'ip', key: `ip:${ipHash}`, max: RATE_LIMIT_IP_MAX_ATTEMPTS },
    { limitType: 'email', key: `email:${emailHash}`, max: RATE_LIMIT_EMAIL_MAX_ATTEMPTS },
  ] as const;

  for (const { limitType, key, max } of limits) {
    const { data: ok, error } = await serviceClient.rpc('reg_check_rate_limit', {
      p_key_hash: key,
      p_window_seconds: RATE_LIMIT_WINDOW_SECONDS,
      p_max_attempts: max,
    });
    if (error || typeof ok !== 'boolean') {
      console.error(`${limitType} rate limit check error:`, error ?? `unexpected result ${JSON.stringify(ok)}`);
      return { allowed: false, limitType: 'error' };
    }
    if (!ok) return { allowed: false, limitType };
  }

  return { allowed: true };
}

async function checkDeadlineAndOpen(): Promise<boolean> {
  const supabase = await createClient();
  
  const { data } = await supabase
    .from('reg_settings')
    .select('applications_open, deadline')
    .eq('id', 1)
    .single();
  
  if (!data) return false;
  
  const isOpen = data.applications_open !== false;
  const beforeDeadline = !data.deadline || new Date(data.deadline) > new Date();
  
  return isOpen && beforeDeadline;
}

export async function saveDraft(fields: Partial<ApplicationDraft>): Promise<SaveDraftResult> {
  try {
    const user = await getVerifiedUser();
    
    if (!user) {
      return { ok: false, code: 'not_verified', error: 'Email not verified' };
    }

    const draftSchema = applicationDraftSchema.partial();
    let result = draftSchema.safeParse(fields);
    let fieldErrors: Record<string, string[]> | undefined;

    // One half-typed field (a link, an age) shouldn't stop the rest of the draft
    // saving: drop the invalid fields, save what's valid, and report the dropped ones.
    if (!result.success) {
      fieldErrors = issuesToFieldErrors(result.error.issues);
      const invalid = new Set(result.error.issues.map((issue) => String(issue.path[0])));
      const valid = fields && typeof fields === 'object'
        ? Object.fromEntries(Object.entries(fields).filter(([key]) => !invalid.has(key)))
        : {};
      result = draftSchema.safeParse(valid);
      if (!result.success) {
        return { ok: false, code: 'validation', error: 'Validation failed', fieldErrors };
      }
    }

    const canSubmit = await checkDeadlineAndOpen();
    if (!canSubmit) {
      return { ok: false, code: 'locked', error: 'Applications are closed or past deadline' };
    }

    const supabase = await createClient();

    const updateData: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(result.data)) {
      if (value !== undefined) {
        updateData[key] = value === '' ? null : value;
      }
    }

    const { error } = await supabase
      .from('applications')
      .upsert(
        {
          user_id: user.id,
          email: user.email.toLowerCase(),
          ...updateData,
        },
        { onConflict: 'user_id' }
      );

    if (error) {
      console.error('Draft upsert error:', error);
      if (error.message?.includes('already submitted') || error.message?.includes('status')) {
        return { ok: false, code: 'already_submitted', error: 'Application already submitted' };
      }
      return { ok: false, code: 'server', error: 'Failed to save draft' };
    }

    return { ok: true, savedAt: new Date().toISOString(), ...(fieldErrors && { fieldErrors }) };
  } catch (error) {
    console.error('saveDraft error:', error);
    return { ok: false, code: 'server', error: 'An unexpected error occurred' };
  }
}

export async function getResumeUploadUrl(): Promise<GetResumeUploadUrlResult> {
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
    console.error('getResumeUploadUrl error:', error);
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

function toIndemnificationApplicant(fields: {
  first_name: string;
  last_name: string;
  preferred_name?: string | null;
  university: string;
  linkedin_url?: string | null;
  github_url?: string | null;
  portfolio_url?: string | null;
}): IndemnificationApplicant {
  return {
    firstName: fields.first_name,
    lastName: fields.last_name,
    preferredName: fields.preferred_name ?? '',
    university: fields.university,
    linkedinUrl: fields.linkedin_url ?? '',
    githubUrl: fields.github_url ?? '',
    portfolioUrl: fields.portfolio_url ?? '',
  };
}

export async function previewIndemnification(input: {
  first_name: string;
  last_name: string;
  preferred_name: string;
  university: string;
  linkedin_url: string;
  github_url: string;
  portfolio_url: string;
}): Promise<PreviewIndemnificationResult> {
  try {
    const user = await getVerifiedUser();

    if (!user) {
      return { ok: false, code: 'not_verified', error: 'Email not verified' };
    }

    const result = indemnificationPreviewSchema.safeParse(input);
    if (!result.success) {
      return { ok: false, code: 'validation', error: 'Validation failed' };
    }

    const pdf = await previewFilledForm(toIndemnificationApplicant(result.data), new Date());

    return { ok: true, pdfBase64: Buffer.from(pdf).toString('base64') };
  } catch (error) {
    console.error('previewIndemnification error:', error);
    return { ok: false, code: 'server', error: 'An unexpected error occurred' };
  }
}

export async function submitApplication(input: {
  fields: Record<string, unknown>;
  turnstileToken: string;
  startedAt: number;
  website?: string;
  submissionId: string;
}): Promise<SubmitApplicationResult> {
  try {
    const user = await getVerifiedUser();
    
    if (!user) {
      return { ok: false, code: 'not_verified', error: 'Email not verified' };
    }

    // Names only, so a misconfigured deploy says what to fix instead of a generic error.
    const missingEnv = REQUIRED_SUBMIT_ENV.filter((name) => !process.env[name]);
    if (missingEnv.length > 0) {
      console.error('submitApplication missing env:', missingEnv.join(', '));
      return { ok: false, code: 'server', error: `Server is missing ${missingEnv.join(', ')}` };
    }

    const serviceClient = createServiceClient();

    const { data: existingSubmission } = await serviceClient
      .from('applications')
      .select('id, submitted_at')
      .eq('submission_id', input.submissionId)
      .eq('user_id', user.id)
      .maybeSingle();
    
    if (existingSubmission?.submitted_at) {
      return {
        ok: true,
        applicationId: existingSubmission.id,
        submittedAt: existingSubmission.submitted_at,
      };
    }
    
    const { data: alreadySubmitted } = await serviceClient
      .from('applications')
      .select('id, submitted_at')
      .eq('user_id', user.id)
      .eq('status', 'submitted')
      .maybeSingle();
    
    if (alreadySubmitted?.submitted_at) {
      return {
        ok: true,
        applicationId: alreadySubmitted.id,
        submittedAt: alreadySubmitted.submitted_at,
      };
    }

    if (input.website && input.website.trim() !== '') {
      return { ok: false, code: 'validation', error: 'Invalid submission' };
    }

    // startedAt is when this page loaded, so someone reopening a finished draft
    // can trip it. The draft's age is the real time they've been applying.
    if (Date.now() - input.startedAt < MIN_SUBMIT_TIME_MS) {
      const { data: draft } = await serviceClient
        .from('applications')
        .select('created_at')
        .eq('user_id', user.id)
        .maybeSingle();

      if (!draft || Date.now() - Date.parse(draft.created_at) < MIN_SUBMIT_TIME_MS) {
        return { ok: false, code: 'too_fast', error: 'Please wait a few seconds, then try again.' };
      }
    }

    if (!z.uuid().safeParse(input.submissionId).success) {
      return { ok: false, code: 'validation', error: 'Invalid submission' };
    }

    const result = applicationSubmitSchema.safeParse(input.fields);

    if (!result.success) {
      return { ok: false, code: 'validation', error: 'Validation failed', fieldErrors: issuesToFieldErrors(result.error.issues) };
    }

    const clientIp = await getClientIp();
    const ipHash = hashKey(clientIp);
    const emailHash = hashKey(user.email.toLowerCase());
    
    // Captcha first: a failed captcha shouldn't use up a real person's attempts,
    // and bots that fail it never reach the rate limit at all.
    const turnstileValid = await verifyTurnstile(input.turnstileToken, clientIp);
    if (!turnstileValid) {
      return { ok: false, code: 'turnstile', error: 'Captcha verification failed. Please try again.' };
    }

    const rateLimitResult = await checkRateLimits(ipHash, emailHash);
    if (rateLimitResult.limitType === 'error') {
      return { ok: false, code: 'server', error: "Couldn't check your submission right now. Please try again in a minute." };
    }
    if (!rateLimitResult.allowed) {
      return { ok: false, code: 'rate_limited', error: 'Too many submission attempts. Please try again later.' };
    }

    const canSubmit = await checkDeadlineAndOpen();
    if (!canSubmit) {
      return { ok: false, code: 'locked', error: 'Applications are closed or past deadline' };
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

    const stampedAt = new Date();
    const indemnificationPath = `${user.id}/${input.submissionId}.pdf`;
    const indemnificationPdf = await previewFilledForm(toIndemnificationApplicant(data), stampedAt);
    const { error: uploadError } = await serviceClient.storage
      .from('indemnifications')
      .upload(indemnificationPath, indemnificationPdf, { contentType: 'application/pdf', upsert: true });

    if (uploadError) {
      console.error('Indemnification upload error:', uploadError);
      return { ok: false, code: 'server', error: 'Failed to store the indemnification form' };
    }

    const { data: rpcResult, error: rpcError } = await serviceClient.rpc('reg_submit_application', {
      p_submission_id: input.submissionId,
      p_first_name: data.first_name,
      p_last_name: data.last_name,
      p_preferred_name: data.preferred_name || null,
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
      p_other_links: data.other_links?.length ? data.other_links : null,
      p_resume_path: data.resume_path,
      p_q_proud: data.q_proud,
      p_q_hack: data.q_hack,
      p_q_anything_else: data.q_anything_else || null,
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
      p_guardian_relationship: data.guardian_relationship || null,
      p_consent_coc: data.consent_coc,
      p_consent_privacy: data.consent_privacy,
      p_consent_photo: data.consent_photo ?? null,
      p_share_resume_with_sponsors: data.share_resume_with_sponsors ?? null,
      p_consent_indemnification: data.consent_indemnification,
      p_consent_esignature: data.consent_esignature,
      p_indemnification_path: indemnificationPath,
      p_stamped_at: stampedAt.toISOString(),
      p_email: user.email.toLowerCase(),
      p_user_id: user.id,
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
      if (response.error === 'indemnification_required') {
        return {
          ok: false,
          code: 'validation',
          error: 'You must accept the indemnification form',
          fieldErrors: { consent_indemnification: ['You must accept the indemnification form'] },
        };
      }
      if (response.error === 'esignature_required') {
        const message = 'You must agree that electronic signatures are legally binding';
        return { ok: false, code: 'validation', error: message, fieldErrors: { consent_esignature: [message] } };
      }
      return { ok: false, code: 'server', error: response.error };
    }

    if (response.ok && response.application_id) {
      // cacheComponents keeps visited pages alive, so without this the back
      // button reopens the editable form for an application that's already in.
      for (const path of ['/apply', '/apply/status', '/dashboard']) {
        revalidatePath(path);
      }
      // The RPC hands back the original submitted_at when this was a repeat submit, so
      // only a fresh submission (stamped with our time) gets the email. Sent after the
      // response, so a slow or failed email never holds up the form.
      if (response.submitted_at && new Date(response.submitted_at).getTime() === stampedAt.getTime()) {
        const to = user.email;
        after(() => sendApplicationReceivedEmail(to, { firstName: data.first_name, pdf: indemnificationPdf }));
      }
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
