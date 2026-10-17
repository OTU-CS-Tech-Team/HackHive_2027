# HackHive 2027 Registration Backend

## Overview

This document describes the backend implementation for HackHive 2027 registration system. The backend is built with:

- **Next.js 16** (App Router) with Server Actions
- **Supabase** for database, auth, and storage
- **Zod 4** for validation
- **Cloudflare Turnstile** for bot protection

## Security Model

### Client vs Service Role

The backend enforces a strict separation between client-accessible and server-only operations:

**Client-accessible (via RLS):**
- Read/update own draft application
- Upload resume to own folder
- View registration settings

**Service-role only (not callable by clients):**
- `reg_submit_application()` - Atomic application submission
- `reg_check_rate_limit()` - Rate limiting
- `reg_cleanup_rate_limits()` - Rate limit cleanup
- `reg_get_settings()` - Settings retrieval for server logic

All service-role functions have `EXECUTE` revoked from `public`, `anon`, and `authenticated` roles. Only `service_role` can call them. The server actions use a sessionless service-role client for these operations.

### Protected Columns Trigger

A `BEFORE INSERT/UPDATE` trigger (`reg_protect_columns`) blocks client changes to:
- `id`, `user_id`, `email` - Identity columns
- `status`, `submitted_at`, `submission_id` - Submission state
- `created_at` - Immutable timestamp

Only service-role connections (via `reg_submit_application()`) can modify these columns.

### RLS Policies

**INSERT policy:**
- `user_id = auth.uid()`
- `lower(email) = lower(auth.jwt()->>'email')`
- `status = 'draft'`
- `submitted_at is null`
- `submission_id is null`
- Applications must be open and before deadline

**UPDATE policy:**
- Own row only
- Status must be 'draft'
- Applications must be open and before deadline

## Important: Non-Destructive Migrations

The HackHive Supabase project has existing tables (`profiles`, `admin_users`, `events`, `sponsors`, etc.). Our migrations:

- **ONLY create new objects** - never alter, drop, or truncate existing tables
- Use plain `CREATE FUNCTION` (not `CREATE OR REPLACE`) - collisions fail loudly
- Use `CREATE ... IF NOT EXISTS` for tables
- Use `DROP POLICY IF EXISTS` before `CREATE POLICY` for idempotency
- Prefix all helper tables/functions with `reg_` to avoid conflicts
- Never touch pre-existing functions like `public.is_admin()` (used by other team features)
- The `applications` table keeps its name (no prefix)

## Setup

### Prerequisites

- Node.js 20+
- Docker (for local Supabase)
- Supabase CLI (`npm install -g supabase`)

### Local Development

1. **Install dependencies:**
   ```bash
   npm install
   ```

2. **Start local Supabase:**
   ```bash
   supabase start
   ```
   This will output the local API URL, anon key, and service role key.

3. **Copy environment variables:**
   ```bash
   cp .env.example .env.local
   ```
   Update `.env.local` with the values from `supabase start` output.

4. **Run migrations:**
   ```bash
   supabase db push
   ```

5. **Start the dev server:**
   ```bash
   npm run dev
   ```

### Making an Admin

Registration admins are stored in the `reg_admins` table (separate from any existing `admin_users` table).

To add a registration admin:

```sql
-- First, find the user's UUID from auth.users
SELECT id, email FROM auth.users WHERE email = 'admin@example.com';

-- Then insert into reg_admins
INSERT INTO public.reg_admins (user_id) VALUES ('user-uuid-here');
```

Or via the Supabase dashboard:
1. Go to Table Editor → `reg_admins`
2. Insert a new row with the user's UUID from `auth.users`

**Note:** The `reg_admins` table is independent of any existing `admin_users` table in the project. A user must be explicitly added to `reg_admins` to have registration admin privileges.

## Database Schema

### Tables

#### `applications`
Main table storing hackathon applications. One row per user.

| Column | Type | Description |
|--------|------|-------------|
| id | uuid | Primary key |
| user_id | uuid | References auth.users (unique) |
| email | text | User's email (lowercase, unique) |
| status | text | 'draft' or 'submitted' |
| submitted_at | timestamptz | When submitted |
| submission_id | text | Unique idempotency key for submission |
| first_name, last_name | text | Applicant name |
| phone | text | Phone number |
| age | int | 13-100 |
| q_anything_else | text | Optional extra question |
| guardian_relationship | text | Relationship to guardian (required if under 18) |
| share_resume_with_sponsors | boolean | Whether to share resume |
| ... | ... | See migration for full list |

#### `reg_admins`
List of registration admin users. Separate from any existing `admin_users` table.

| Column | Type | Description |
|--------|------|-------------|
| user_id | uuid | Primary key, references auth.users |
| created_at | timestamptz | When added |

#### `reg_settings`
Single-row table for registration settings.

| Column | Type | Description |
|--------|------|-------------|
| applications_open | boolean | Whether applications are accepting |
| deadline | timestamptz | Submission deadline |

#### `reg_rate_limits`
Rate limiting table (not accessible by clients via RLS).

### Functions (all prefixed with `reg_`)

| Function | Callable By | Description |
|----------|-------------|-------------|
| `reg_is_admin()` | authenticated | Check if current user is a registration admin |
| `reg_can_submit()` | authenticated | Check if applications are open and before deadline |
| `reg_get_settings()` | service_role | Get deadline and open status |
| `reg_submit_application(...)` | service_role | Atomic application submission |
| `reg_check_rate_limit(...)` | service_role | Atomic rate limit check-and-increment |
| `reg_cleanup_rate_limits(...)` | service_role | Clean up old rate limit entries |
| `reg_update_updated_at()` | (trigger) | Trigger function for updated_at |
| `reg_protect_columns()` | (trigger) | Trigger to block client changes to protected columns |

### Triggers

| Trigger | Table | Description |
|---------|-------|-------------|
| `reg_applications_updated_at` | applications | Updates `updated_at` on row changes |
| `reg_settings_updated_at` | reg_settings | Updates `updated_at` on settings changes |
| `reg_applications_protect_columns` | applications | Blocks client changes to protected columns |

### RLS Policies

- **Applicants**: Can only read/write their own draft application
- **INSERT**: Requires `status='draft'`, matching user email, no submitted_at/submission_id, and open+before deadline
- **UPDATE**: Only allowed while `status='draft'` and before deadline
- **Registration Admins** (in `reg_admins`): Can read all applications
- **No deletes**: Applicants cannot delete applications

## API Contract

### Server Actions

All server actions are in `src/app/actions/applications.ts`.

#### `saveDraft(fields)`

Save a partial application draft. Uses upsert with `onConflict: 'user_id'` to handle concurrent saves.

**Input:** Partial application fields (all optional)

**Output:**
```typescript
{ ok: true, savedAt: string }
| { ok: false, code: ErrorCode, error: string, fieldErrors?: Record<string, string[]> }
```

#### `getResumeUploadUrl()`

Get a signed URL for direct resume upload to Supabase Storage.

**Output:**
```typescript
{ ok: true, path: string, signedUrl: string, token: string }
| { ok: false, code: ErrorCode, error: string }
```

**Usage:**
1. Call `getResumeUploadUrl()` to get signed URL
2. Client uploads PDF directly to the signedUrl
3. Client calls `saveDraft({ resume_path: path })`

#### `submitApplication({ fields, turnstileToken, startedAt, website, submissionId })`

Submit the final application. Validates all fields and prevents modifications.

**Input:**
- `fields`: Complete application data
- `turnstileToken`: Cloudflare Turnstile response token
- `startedAt`: Timestamp when user started filling form (for bot detection)
- `website`: Honeypot field (should be empty)
- `submissionId`: Unique key for idempotent submission

**Processing order:**
1. Check for existing submission by `submissionId` (returns original success if found)
2. Check if already submitted (returns original success if found)
3. Honeypot and timing checks
4. Zod validation
5. Rate limiting (only after validation passes)
6. Turnstile verification
7. Deadline check
8. Resume verification
9. Atomic submit via `reg_submit_application()`

**Output:**
```typescript
{ ok: true, applicationId: string, submittedAt: string }
| { ok: false, code: ErrorCode, error: string, fieldErrors?: Record<string, string[]> }
```

**Error Codes:**
- `not_verified`: Email not verified
- `validation`: Field validation failed
- `rate_limited`: Too many submission attempts
- `turnstile`: Captcha verification failed
- `too_fast`: Form submitted too quickly (< 3 seconds)
- `locked`: Applications closed or past deadline
- `already_submitted`: Application already submitted
- `server`: Server error

#### `getMyApplication()`

Get the current user's application.

**Output:**
```typescript
{ ok: true, application: Application | null }
| { ok: false, code: ErrorCode, error: string }
```

## Storage

### Resumes Bucket

- **Bucket name:** `resumes`
- **Public:** No
- **File size limit:** 5MB
- **Allowed types:** `application/pdf` only
- **Path structure:** `<user_id>/resume-<uuid>.pdf`

The bucket is created only if it doesn't exist (no destructive operations).

## Authentication

Uses Supabase Auth with email verification.

### Supported Methods

- **Magic Link:** Email link for passwordless login
- **OTP:** Email code verification

### Auth Flow

1. User enters email
2. Supabase sends magic link or OTP
3. User clicks link or enters code
4. Session is established
5. `requireVerifiedUser()` checks email is confirmed before allowing application

### Routes

- `/auth/login` - Login page
- `/auth/verify-email` - Email verification prompt
- `/auth/callback` - OAuth/magic link callback handler
- `/auth/error` - Auth error page

### Open Redirect Protection

The `/auth/callback` route validates the `next` parameter:
- Must start with a single `/` (not `//` or `/\`)
- No protocol handlers (`:` not allowed)
- URL origin must match the request origin
- Falls back to `/` if validation fails

## Security Features

### Rate Limiting

- **Per-IP:** 100 attempts per hour (high limit for campus Wi-Fi shared IPs)
- **Per-email:** 5 attempts per hour (tight limit)
- Rate limit only counts after Zod validation passes
- Uses HMAC-SHA256 hashed keys (never stores raw IP/email)
- Atomic check-and-increment via `reg_check_rate_limit()`
- Called via service-role client only

### Bot Protection

- Cloudflare Turnstile captcha
- Honeypot field (`website`)
- Minimum time check (3 seconds)

### Idempotency

- Prevents double submissions
- Same `submissionId` returns original success response (critical because Turnstile tokens are single-use)
- Already-submitted users get their original success (not an error)
- Concurrent submissions handled atomically via `reg_submit_application()`

### Service Role Client

The `createServiceClient()` function creates a sessionless Supabase client:
- Uses `@supabase/supabase-js` (not `@supabase/ssr`)
- No cookies, no session persistence
- `autoRefreshToken: false`, `persistSession: false`
- Only used server-side for calling service-role-only functions

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `NEXT_PUBLIC_SUPABASE_URL` | Yes | Supabase API URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Yes | Supabase anon/public key |
| `SUPABASE_SERVICE_ROLE_KEY` | Yes | Service role key (server only) |
| `RATE_LIMIT_HASH_SECRET` | Yes | Secret for hashing IPs/emails |
| `NEXT_PUBLIC_TURNSTILE_SITE_KEY` | Yes | Turnstile site key |
| `TURNSTILE_SECRET_KEY` | Yes | Turnstile secret key |

## Field Renames from Original Spec

- `q_extra` → `q_anything_else`
- `share_resume_sponsors` → `share_resume_with_sponsors`
- `idempotency_key` → `submission_id` (column) / `submissionId` (action param)
- `createResumeUpload` → `getResumeUploadUrl`

## Added Fields

- `guardian_relationship` (required with `guardian_name` and `guardian_phone` when age < 18)

## Table/Function Naming Convention

All helper tables and functions are prefixed with `reg_` to avoid conflicts with existing project objects:

| Original Name | Prefixed Name |
|---------------|---------------|
| `admins` | `reg_admins` |
| `app_settings` | `reg_settings` |
| `application_rate_limits` | `reg_rate_limits` |
| `is_admin()` | `reg_is_admin()` |
| `check_rate_limit()` | `reg_check_rate_limit()` |
| `can_submit_application()` | `reg_can_submit()` |
| `submit_application()` | `reg_submit_application()` |
| `get_application_settings()` | `reg_get_settings()` |
| `cleanup_rate_limits()` | `reg_cleanup_rate_limits()` |
| `update_updated_at()` | `reg_update_updated_at()` |
| (new) | `reg_protect_columns()` |

The `applications` table keeps its name (no prefix).

## Deployment Checklist

### Supabase Setup (Production)

1. Run migrations: `supabase db push --linked`
   - Migrations are safe to run on existing databases
   - They only create new objects, never alter/drop existing ones
2. Configure Auth settings:
   - Enable email confirmations
   - Set site URL and redirect URLs
   - Configure SMTP for email sending
3. The resumes storage bucket is created by migrations if it doesn't exist

### Vercel Setup

1. Add all environment variables
2. Set `SUPABASE_SERVICE_ROLE_KEY` as server-only
3. Configure domain for auth redirects

### Cloudflare Turnstile

1. Create a new Turnstile site at https://dash.cloudflare.com/turnstile
2. Add your domain
3. Copy site key (public) and secret key

### Post-Deploy

1. Add registration admins to `reg_admins` table (see "Making an Admin" above)
2. Set `applications_open` and `deadline` in `reg_settings`
3. Test auth flow end-to-end
4. Test application submission flow
