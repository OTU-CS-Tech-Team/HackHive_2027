import { z } from 'zod';

const MAX_WORDS_Q1_Q2 = 200;
const RECOMMENDED_WORDS_Q1_Q2 = 150;
const MAX_CHARS_Q1_Q2 = 2000;
const MAX_CHARS_Q3 = 2000;

function countWords(text: string): number {
  return text.trim().split(/\s+/).filter(Boolean).length;
}

function normalizeUnicode(val: string): string {
  return val.trim().normalize('NFC');
}

const unicodeNameRegex = /^[\p{L}\p{M}'\- ]+$/u;

const urlSchema = z
  .string()
  .max(500)
  .url()
  .optional()
  .or(z.literal(''));

const linkedinUrlSchema = z
  .string()
  .max(500)
  .refine(
    (val) => !val || val.startsWith('https://linkedin.com/') || val.startsWith('https://www.linkedin.com/'),
    { message: 'Must be a valid LinkedIn URL' }
  )
  .optional()
  .or(z.literal(''));

const githubUrlSchema = z
  .string()
  .max(500)
  .refine(
    (val) => !val || val.startsWith('https://github.com/'),
    { message: 'Must be a valid GitHub URL' }
  )
  .optional()
  .or(z.literal(''));

const teammateEmailsSchema = z
  .array(z.string().email())
  .max(3, 'Maximum 3 teammate emails allowed')
  .optional();

const questionSchema = (maxWords: number, maxChars: number) =>
  z
    .string()
    .max(maxChars, `Maximum ${maxChars} characters`)
    .refine(
      (val) => !val || countWords(val) <= maxWords,
      { message: `Maximum ${maxWords} words allowed (recommended: ${RECOMMENDED_WORDS_Q1_Q2})` }
    )
    .transform(normalizeUnicode)
    .optional()
    .or(z.literal(''));

const nameFieldSchema = z
  .string()
  .max(100)
  .refine(
    (val) => !val || unicodeNameRegex.test(val),
    { message: 'Name contains invalid characters' }
  )
  .transform(normalizeUnicode)
  .optional()
  .or(z.literal(''));

export const applicationDraftSchema = z.object({
  first_name: nameFieldSchema,
  last_name: nameFieldSchema,
  phone: z.string().max(30).optional().or(z.literal('')),
  age: z.coerce.number().int().min(13).max(100).optional().nullable(),
  pronouns: z.string().max(50).optional().or(z.literal('')),
  city: z.string().max(100).transform(normalizeUnicode).optional().or(z.literal('')),
  country: z.string().max(100).transform(normalizeUnicode).optional().or(z.literal('')),
  
  university: z.string().max(200).transform(normalizeUnicode).optional().or(z.literal('')),
  program: z.string().max(200).transform(normalizeUnicode).optional().or(z.literal('')),
  year_of_study: z.string().max(50).optional().or(z.literal('')),
  grad_date: z.coerce.date().optional().nullable(),
  hackathons_count: z.coerce.number().int().min(0).optional().nullable(),
  
  linkedin_url: linkedinUrlSchema,
  github_url: githubUrlSchema,
  portfolio_url: urlSchema,
  resume_path: z.string().max(500).optional().or(z.literal('')),
  
  q_proud: questionSchema(MAX_WORDS_Q1_Q2, MAX_CHARS_Q1_Q2),
  q_hack: questionSchema(MAX_WORDS_Q1_Q2, MAX_CHARS_Q1_Q2),
  q_extra: z.string().max(MAX_CHARS_Q3).transform(normalizeUnicode).optional().or(z.literal('')),
  
  team_status: z.enum(['solo', 'has_team', 'looking']).optional().nullable(),
  teammate_emails: teammateEmailsSchema,
  
  dietary: z.string().max(500).optional().or(z.literal('')),
  accessibility: z.string().max(1000).optional().or(z.literal('')),
  tshirt_size: z.string().max(20).optional().or(z.literal('')),
  needs_travel_help: z.boolean().optional().nullable(),
  
  gender: z.string().max(50).optional().or(z.literal('')),
  ethnicity: z.string().max(100).optional().or(z.literal('')),
  
  guardian_name: z.string().max(200).transform(normalizeUnicode).optional().or(z.literal('')),
  guardian_phone: z.string().max(30).optional().or(z.literal('')),
  
  consent_coc: z.boolean().optional().nullable(),
  consent_privacy: z.boolean().optional().nullable(),
  consent_photo: z.boolean().optional().nullable(),
  share_resume_sponsors: z.boolean().optional().nullable(),
});

export type ApplicationDraft = z.infer<typeof applicationDraftSchema>;

const requiredName = z
  .string()
  .min(1, 'Required')
  .max(100)
  .refine(
    (val) => unicodeNameRegex.test(val),
    { message: 'Name contains invalid characters' }
  )
  .transform(normalizeUnicode);

const requiredQuestion = (maxWords: number, maxChars: number) =>
  z
    .string()
    .min(1, 'Required')
    .max(maxChars, `Maximum ${maxChars} characters`)
    .refine(
      (val) => countWords(val) <= maxWords,
      { message: `Maximum ${maxWords} words allowed (recommended: ${RECOMMENDED_WORDS_Q1_Q2})` }
    )
    .transform(normalizeUnicode);

export const applicationSubmitSchema = z
  .object({
    first_name: requiredName,
    last_name: requiredName,
    phone: z.string().min(1, 'Required').max(30),
    age: z.coerce.number().int().min(13, 'Must be at least 13').max(100, 'Must be at most 100'),
    pronouns: z.string().max(50).optional().or(z.literal('')),
    city: z.string().min(1, 'Required').max(100).transform(normalizeUnicode),
    country: z.string().min(1, 'Required').max(100).transform(normalizeUnicode),

    university: z.string().min(1, 'Required').max(200).transform(normalizeUnicode),
    program: z.string().min(1, 'Required').max(200).transform(normalizeUnicode),
    year_of_study: z.string().min(1, 'Required').max(50),
    grad_date: z.coerce.date().optional().nullable(),
    hackathons_count: z.coerce.number().int().min(0).optional().nullable(),

    linkedin_url: linkedinUrlSchema,
    github_url: githubUrlSchema,
    portfolio_url: urlSchema,
    resume_path: z.string().min(1, 'Resume is required').max(500),

    q_proud: requiredQuestion(MAX_WORDS_Q1_Q2, MAX_CHARS_Q1_Q2),
    q_hack: requiredQuestion(MAX_WORDS_Q1_Q2, MAX_CHARS_Q1_Q2),
    q_extra: z.string().max(MAX_CHARS_Q3).transform(normalizeUnicode).optional().or(z.literal('')),

    team_status: z.enum(['solo', 'has_team', 'looking'], {
      error: 'Please select your team status',
    }),
    teammate_emails: z
      .array(z.string().email('Invalid email'))
      .max(3, 'Maximum 3 teammate emails allowed')
      .optional(),

    dietary: z.string().max(500).optional().or(z.literal('')),
    accessibility: z.string().max(1000).optional().or(z.literal('')),
    tshirt_size: z.string().min(1, 'Required').max(20),
    needs_travel_help: z.boolean().optional().nullable(),

    gender: z.string().max(50).optional().or(z.literal('')),
    ethnicity: z.string().max(100).optional().or(z.literal('')),

    guardian_name: z.string().max(200).transform(normalizeUnicode).optional().or(z.literal('')),
    guardian_phone: z.string().max(30).optional().or(z.literal('')),

    consent_coc: z.literal(true, {
      error: 'You must agree to the Code of Conduct',
    }),
    consent_privacy: z.literal(true, {
      error: 'You must agree to the Privacy Policy',
    }),
    consent_photo: z.boolean().optional().nullable(),
    share_resume_sponsors: z.boolean().optional().nullable(),
  })
  .superRefine((data, ctx) => {
    if (data.age < 18) {
      if (!data.guardian_name || data.guardian_name.trim() === '') {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'Guardian name is required for applicants under 18',
          path: ['guardian_name'],
        });
      }
      if (!data.guardian_phone || data.guardian_phone.trim() === '') {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'Guardian phone is required for applicants under 18',
          path: ['guardian_phone'],
        });
      }
    }

    if (data.resume_path) {
      const parts = data.resume_path.split('/');
      if (parts.length < 2) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'Invalid resume path format',
          path: ['resume_path'],
        });
      }
    }
  });

export type ApplicationSubmit = z.infer<typeof applicationSubmitSchema>;

export const submitRequestSchema = applicationSubmitSchema.extend({
  turnstileToken: z.string().min(1, 'Captcha token required'),
  startedAt: z.coerce.number(),
  website: z.string().optional(),
  idempotencyKey: z.string().min(1, 'Idempotency key required'),
});

export type SubmitRequest = z.infer<typeof submitRequestSchema>;

export const ERROR_CODES = [
  'validation',
  'rate_limited',
  'turnstile',
  'too_fast',
  'locked',
  'already_submitted',
  'not_verified',
  'server',
] as const;

export type ErrorCode = (typeof ERROR_CODES)[number];

export type SaveDraftResult =
  | { ok: true; savedAt: string }
  | { ok: false; code: ErrorCode; error: string; fieldErrors?: Record<string, string[]> };

export type CreateResumeUploadResult =
  | { ok: true; path: string; signedUrl: string; token: string }
  | { ok: false; code: ErrorCode; error: string };

export type SubmitApplicationResult =
  | { ok: true; applicationId: string; submittedAt: string }
  | { ok: false; code: ErrorCode; error: string; fieldErrors?: Record<string, string[]> };

export type Application = {
  id: string;
  user_id: string;
  email: string;
  status: 'draft' | 'submitted';
  submitted_at: string | null;
  created_at: string;
  updated_at: string;
  first_name: string | null;
  last_name: string | null;
  phone: string | null;
  age: number | null;
  pronouns: string | null;
  city: string | null;
  country: string | null;
  university: string | null;
  program: string | null;
  year_of_study: string | null;
  grad_date: string | null;
  hackathons_count: number | null;
  linkedin_url: string | null;
  github_url: string | null;
  portfolio_url: string | null;
  resume_path: string | null;
  q_proud: string | null;
  q_hack: string | null;
  q_extra: string | null;
  team_status: 'solo' | 'has_team' | 'looking' | null;
  teammate_emails: string[] | null;
  dietary: string | null;
  accessibility: string | null;
  tshirt_size: string | null;
  needs_travel_help: boolean | null;
  gender: string | null;
  ethnicity: string | null;
  guardian_name: string | null;
  guardian_phone: string | null;
  consent_coc: boolean | null;
  consent_privacy: boolean | null;
  consent_photo: boolean | null;
  share_resume_sponsors: boolean | null;
};

export type GetMyApplicationResult =
  | { ok: true; application: Application }
  | { ok: true; application: null }
  | { ok: false; code: ErrorCode; error: string };
