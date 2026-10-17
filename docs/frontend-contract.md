# Frontend-Backend Contract

This document defines the shared contract between frontend and backend for the HackHive 2027 registration system.

## Shared Schema

**Location:** `src/lib/application/schema.ts` (singular)

**Owner:** Tabish (branch: `tabish-registration-backend`)

This file contains:
- Zod schemas for validation
- TypeScript types
- Field name constants
- Field limits

## Database Table: `applications`

| Column | Type | Required | Max Length/Limit | Notes |
|--------|------|----------|------------------|-------|
| id | uuid | auto | - | Primary key |
| user_id | uuid | auto | - | Foreign key to auth.users, unique |
| email | string | yes | - | Unique, lowercased |
| status | enum | yes | - | 'draft' \| 'submitted' |
| submission_id | uuid | no | - | Idempotency key for submit |
| submitted_at | timestamp | no | - | Set on submit |
| created_at | timestamp | auto | - | |
| updated_at | timestamp | auto | - | |
| first_name | string | yes | 100 | |
| last_name | string | yes | 100 | |
| phone | string | yes | 30 | |
| age | integer | yes | 13-120 | |
| pronouns | string | no | 50 | |
| city | string | yes | 100 | |
| country | string | yes | 100 | |
| university | string | yes | 200 | |
| program | string | yes | 200 | |
| year_of_study | integer | yes | 1-10 | |
| grad_date | string | yes | - | Date string |
| hackathons_count | integer | yes | 0-100 | Default 0 |
| linkedin_url | string | no | 500 | Valid URL |
| github_url | string | no | 500 | Valid URL |
| portfolio_url | string | no | 500 | Valid URL |
| resume_path | string | yes | - | Path in Storage bucket |
| q_proud | string | yes | 2000 chars | ~150 words |
| q_hack | string | yes | 2000 chars | ~150 words |
| q_anything_else | string | no | 2000 chars | ~150 words |
| team_status | enum | yes | - | 'solo' \| 'has_team' \| 'looking' |
| teammate_emails | string[] | no | max 3 | Array of emails |
| dietary | string | no | 500 | |
| accessibility | string | no | 1000 | |
| tshirt_size | enum | yes | - | 'XS' \| 'S' \| 'M' \| 'L' \| 'XL' \| 'XXL' |
| needs_travel_help | boolean | yes | - | |
| gender | string | no | 100 | |
| ethnicity | string | no | 200 | |
| guardian_name | string | conditional | 100 | Required if age < 18 |
| guardian_phone | string | conditional | 30 | Required if age < 18 |
| guardian_relationship | string | conditional | 100 | Required if age < 18 |
| consent_coc | boolean | yes | - | Must be true |
| consent_privacy | boolean | yes | - | Must be true |
| consent_photo | boolean | no | - | |
| share_resume_with_sponsors | boolean | no | - | |

## Server Actions

### saveDraft

Saves partial application data as a draft.

```typescript
saveDraft(fields: Partial<DraftApplication>): Promise<SaveDraftResult>

type SaveDraftResult =
  | { ok: true; savedAt: string }
  | { ok: false; code: ErrorCode; error: string; fieldErrors?: Record<string, string[]> }
```

**Constraints:**
- Only drafts can be saved (not submitted applications)
- Partial fields are allowed

### submitApplication

Submits the complete application.

```typescript
submitApplication(
  fields: SubmitApplication,
  params: {
    turnstileToken: string;
    startedAt: number;
    website: string;      // honeypot field, must be empty
    submissionId: string; // idempotency key
  }
): Promise<SubmitResult>

type SubmitResult =
  | { ok: true; applicationId: string; submittedAt: string }
  | { ok: false; code: ErrorCode; error: string; fieldErrors?: Record<string, string[]> }
```

**Constraints:**
- All required fields must be present
- `turnstileToken` validated server-side
- `website` (honeypot) must be empty
- `startedAt` checked for minimum 3 seconds elapsed
- Same `submissionId` returns original success (idempotent)

### getResumeUploadUrl

Gets a signed URL for direct resume upload to Supabase Storage.

```typescript
getResumeUploadUrl(): Promise<ResumeUploadResult>

type ResumeUploadResult =
  | { ok: true; path: string; signedUrl: string; token: string }
  | { ok: false; code: ErrorCode; error: string }
```

**Usage:**
1. Call `getResumeUploadUrl()` to get signed URL
2. Upload PDF directly to Storage using signed URL
3. Call `saveDraft({ resume_path: path })` to save the path

**Constraints:**
- PDF only
- 5 MB max

### getMyApplication

Retrieves the current user's application (for status page and draft restore).

```typescript
getMyApplication(): Promise<GetApplicationResult>

type GetApplicationResult =
  | { ok: true; application: Application }
  | { ok: false; code: ErrorCode; error: string }
```

**Note:** Uses Supabase client with RLS to read own row.

## Error Codes

| Code | Description | Frontend Action |
|------|-------------|-----------------|
| validation | Form validation failed | Show field errors |
| rate_limited | Too many requests | Show retry message |
| turnstile | Captcha verification failed | Refresh page |
| too_fast | Form submitted in < 3 seconds | Show slow down message |
| locked | Applications closed (deadline passed) | Show deadline message |
| already_submitted | Application already submitted | Redirect to status page |
| not_verified | Email not verified | Redirect to verify page |
| server | Server error | Show generic error |

## Environment Variables

```
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
NEXT_PUBLIC_TURNSTILE_SITE_KEY=
```

## Current Status

**Schema source:** Placeholder (Tabish's file not yet on `origin/tabish-registration-backend`)

**Frontend stubs implemented:**
- `saveDraft` - Returns success after 300ms delay
- `submitApplication` - Returns success after 500ms delay
- `getResumeUploadUrl` - Returns mock signed URL
- `getMyApplication` - Returns not found error

All stubs are in `src/lib/application/api.ts` and should be replaced with real Supabase/server action implementations.
