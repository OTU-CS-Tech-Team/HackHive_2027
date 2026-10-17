# HackHive 2027 Registration Backend

## Overview

This document describes the backend implementation for HackHive 2027 registration system. The backend is built with:

- **Next.js 16** (App Router) with Server Actions
- **Supabase** for database, auth, and storage
- **Zod** for validation
- **Cloudflare Turnstile** for bot protection

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

To make a user an admin, insert their user_id into the admins table:

```sql
-- Using Supabase Studio or psql
INSERT INTO public.admins (user_id) VALUES ('user-uuid-here');
```

Or via the Supabase dashboard:
1. Go to Table Editor → admins
2. Insert a new row with the user's UUID

## Database Schema

### Tables

#### `applications`
Main table storing hackathon applications. One row per user.

| Column | Type | Description |
|--------|------|-------------|
| id | uuid | Primary key |
| user_id | uuid | References auth.users |
| email | text | User's email (lowercase) |
| status | text | 'draft' or 'submitted' |
| submitted_at | timestamptz | When submitted |
| first_name, last_name | text | Applicant name |
| phone | text | Phone number |
| age | int | 13-100 |
| ... | ... | See migration for full list |

#### `admins`
List of admin users.

| Column | Type | Description |
|--------|------|-------------|
| user_id | uuid | Primary key, references auth.users |

#### `app_settings`
Single-row table for global settings.

| Column | Type | Description |
|--------|------|-------------|
| applications_open | boolean | Whether applications are accepting |
| deadline | timestamptz | Submission deadline |

#### `application_rate_limits`
Rate limiting table (not accessible by clients).

### RLS Policies

- **Applicants**: Can only read/write their own application
- **Updates**: Only allowed while status='draft' and before deadline
- **Admins**: Can read all applications
- **No deletes**: Applicants cannot delete applications

## API Contract

### Server Actions

All server actions are in `src/app/actions/applications.ts`.

#### `saveDraft(fields)`

Save a partial application draft.

**Input:** Partial application fields (all optional)

**Output:**
```typescript
{ ok: true, savedAt: string }
| { ok: false, code: ErrorCode, error: string, fieldErrors?: Record<string, string[]> }
```

#### `createResumeUpload()`

Get a signed URL for direct resume upload to Supabase Storage.

**Output:**
```typescript
{ ok: true, path: string, signedUrl: string, token: string }
| { ok: false, code: ErrorCode, error: string }
```

**Usage:**
1. Call `createResumeUpload()` to get signed URL
2. Client uploads PDF directly to the signedUrl
3. Client calls `saveDraft({ resume_path: path })`

#### `submitApplication({ fields, turnstileToken, startedAt, website, idempotencyKey })`

Submit the final application. Validates all fields and prevents modifications.

**Input:**
- `fields`: Complete application data
- `turnstileToken`: Cloudflare Turnstile response token
- `startedAt`: Timestamp when user started filling form (for bot detection)
- `website`: Honeypot field (should be empty)
- `idempotencyKey`: Unique key for idempotent submission

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

## Security Features

### Rate Limiting
- By IP and email
- 5 attempts per hour window
- Uses HMAC-SHA256 hashed keys (never stores raw IP/email)
- Atomic check-and-increment in database

### Bot Protection
- Cloudflare Turnstile captcha
- Honeypot field (`website`)
- Minimum time check (3 seconds)

### Idempotency
- Prevents double submissions
- Same idempotency key returns original success response
- Concurrent submissions handled atomically in database

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `NEXT_PUBLIC_SUPABASE_URL` | Yes | Supabase API URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Yes | Supabase anon/public key |
| `SUPABASE_SERVICE_ROLE_KEY` | Yes | Service role key (server only) |
| `RATE_LIMIT_HASH_SECRET` | Yes | Secret for hashing IPs/emails |
| `NEXT_PUBLIC_TURNSTILE_SITE_KEY` | Yes | Turnstile site key |
| `TURNSTILE_SECRET_KEY` | Yes | Turnstile secret key |

## Deployment Checklist

### Supabase Setup (Production)

1. Create a new Supabase project
2. Run migrations: `supabase db push --linked`
3. Configure Auth settings:
   - Enable email confirmations
   - Set site URL and redirect URLs
   - Configure SMTP for email sending
4. Create the resumes storage bucket (migrations handle this)

### Vercel Setup

1. Add all environment variables
2. Set `SUPABASE_SERVICE_ROLE_KEY` as server-only
3. Configure domain for auth redirects

### Cloudflare Turnstile

1. Create a new Turnstile site at https://dash.cloudflare.com/turnstile
2. Add your domain
3. Copy site key (public) and secret key

### Post-Deploy

1. Insert initial admin user
2. Set `applications_open` and `deadline` in `app_settings`
3. Test auth flow end-to-end
4. Test application submission flow
