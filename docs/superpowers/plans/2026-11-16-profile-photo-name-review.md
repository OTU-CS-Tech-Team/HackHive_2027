# Profile Photo, Name and Review Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Google photo by default, a default icon otherwise, photo upload in the application and on the dashboard for everyone, the dashboard name taken from the application, and a Review step before Submit.

**Architecture:** Two Postgres triggers keep `profiles.full_name` and `profiles.avatar_url` in sync (plus one-off backfills). One client `Avatar` component owns the fallback icon; `AvatarUpload` wraps it with the existing crop-and-upload flow. The Review step reuses `ApplicationDetails` from `ApplicationView.tsx`.

**Tech Stack:** Next.js 16 App Router, React 19, Supabase (Postgres + Storage), Tailwind v4, vitest + PGlite.

**Spec:** `docs/superpowers/specs/2026-11-16-profile-photo-name-review-design.md`

## Global Constraints

- Display name = `coalesce(preferred_name, first_name) || ' ' || last_name`, trimmed; never set from a blank first/preferred name.
- An uploaded photo is never replaced by the Google one (only fill when `avatar_url is null`).
- Photo change is open to every signed-in user; `saveAvatarUrl` still rejects URLs outside `avatars/<uid>/`.
- Fallback icon: lucide `UserRound` on a grey circle.

## Review Focus

- Photo URL that 404s (expired Google URL): `Avatar` falls back to the icon via `onError` (checked in browser).
- Applicant with only a last name typed so far: profile name stays as it was (DB test).
- Whitespace-only preferred name: falls back to first name (DB test).
- Google re-sign-in after an upload: uploaded photo kept (DB test).
- Review step must not count as "to fill in" in What's left (skip steps with no fields).

---

### Task 1: Profile sync triggers + backfill

**Files:**
- Create: `supabase/migrations/20261116000000_profile_photo_and_name.sql`
- Test: `tests/profile-sync-db.test.ts`

**Interfaces:**
- Produces: `public.application_display_name(preferred text, first text, last text) returns text`; trigger `applications_sync_profile_name` (after insert or update of name columns on `public.applications`); trigger `on_auth_user_metadata_updated` (after update of `raw_user_meta_data` on `auth.users`). Both trigger functions `security definer set search_path = ''`.

- [ ] **Step 1:** Write `tests/profile-sync-db.test.ts` on PGlite with minimal tables (`auth.users(id, raw_user_meta_data jsonb)`, `public.profiles(id, full_name, avatar_url)`, `public.applications(user_id, first_name, last_name, preferred_name)`), seed pre-existing rows, then run the migration. Assertions:
  - backfill: application `Tabish`/`Ghouri` → profile `Tabish Ghouri`; linked user with `avatar_url` metadata and null profile photo → filled; profile with its own photo unchanged.
  - insert application preferred `Tabby`, first `Tabish`, last `Ghouri` → `Tabby Ghouri`; preferred `'  '` → `Tabish Ghouri`.
  - application with only `last_name` → profile name unchanged.
  - metadata update with `picture` only → profile photo filled; metadata update when profile already has a photo → unchanged.
- [ ] **Step 2:** `npx vitest run tests/profile-sync-db.test.ts` → FAIL (migration file missing).
- [ ] **Step 3:** Write the migration.
- [ ] **Step 4:** Same command → PASS.

### Task 2: Shared Avatar, universal photo change

**Files:**
- Create: `src/components/Avatar.tsx`
- Modify: `src/app/dashboard/AvatarUpload.tsx`, `src/app/dashboard/actions.ts` (`saveAvatarUrl`), `src/app/dashboard/page.tsx` (header, Profile tab), `src/app/admin/scan/Scanner.tsx`

**Interfaces:**
- Produces: `Avatar({ src, className }: { src?: string | null; className?: string })` (client); `AvatarUpload({ avatarUrl, className, label }: { avatarUrl: string | null; className?: string; label?: string })` — avatar is the upload button (camera badge, `aria-label="Change profile photo"`), optional visible text button `label`.

- [ ] **Step 1:** Build `Avatar`, rework `AvatarUpload`, relax `saveAvatarUrl` to sign-in only (also `revalidatePath("/apply")`).
- [ ] **Step 2:** Header uses `AvatarUpload`; remove it from the Profile tab; Scanner uses `Avatar`.
- [ ] **Step 3:** `npx tsc --noEmit` and `npx eslint` on touched files → clean.

### Task 3: Apply form photo field + Review step

**Files:**
- Modify: `src/app/apply/page.tsx` (pass `avatarUrl`), `src/components/apply/ApplyForm.tsx`, `src/components/ApplicationView.tsx`

**Interfaces:**
- Consumes: `AvatarUpload` (Task 2).
- Produces: `export function ApplicationDetails({ application, onEdit, showDemographics }: { application: ApplicationAnswersData; onEdit?: (stepId: string) => void; showDemographics?: boolean })`, `export type ApplicationAnswersData = Pick<Application, …fields it renders… | "gender" | "ethnicity">`.

- [ ] **Step 1:** Optional "Profile picture" row at the top of The basics using `AvatarUpload` with `label` "Upload photo" / "Change photo".
- [ ] **Step 2:** Insert step `{ id: "review", title: "Review", fields: [] }` before Submit and its panel (photo + `ApplicationDetails` with Edit links: Personal/Guardian→about, Education→school, Experience→experience, Short answers→answers, Team & logistics + Demographics→event). Skip field-less steps in What's left.
- [ ] **Step 3:** `npx tsc --noEmit`, `npx eslint`, `npx vitest run` → clean; check `/apply` and `/dashboard` in the browser (photo upload, fallback icon, review, Edit jump).
