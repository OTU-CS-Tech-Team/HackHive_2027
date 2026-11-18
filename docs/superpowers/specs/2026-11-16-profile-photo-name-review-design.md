# Profile photo, display name, and application review

Approved by Tabish, 2026-11-16. Branch `registration-avatar-tabish` (from `main`).

## Why

Every hacker should look like themselves across the site: their Google photo or one they upload, and the name they typed into the application, not their email prefix. Applicants also want to read their whole application once before submitting.

## What we found

- `handle_new_user` fills `profiles.full_name` / `avatar_url` once, on account creation. Accounts made with email first and Google linked later (4 accounts, including Tabish's) keep the email prefix as their name and no photo. Google-first accounts (55) already show their Google photo.
- 46 accounts are email-only and have no photo anywhere.
- Photo upload exists (`AvatarUpload`, `saveAvatarUrl`) but only for accepted hackers on the Profile tab. Storage already lets any signed-in user write to their own `avatars/<uid>/` folder.
- With no photo, the dashboard header shows a plain amber circle and the admin scanner a grey one.

## Design

1. **Google photo as default.** `handle_new_user` already copies it at sign-up. Dropped after review (PR #47): the `auth.users` trigger and backfill for the 4 Google-linked-later accounts. Those hackers can upload a photo instead.
2. **Default icon.** One shared `Avatar` component: the photo when it exists and loads, otherwise a grey person silhouette in a circle. Used by the dashboard header and the admin scanner. (Teammate cards keep their initials; out of scope.)
3. **Upload during registration.** Optional "Profile picture" field at the top of About you → The basics. Saves immediately to the account, not part of the draft.
4. **Change photo for everyone.** "Change photo" on the dashboard header avatar, every tab, every signed-in user. `saveAvatarUrl` needs sign-in only (still checks the URL is in the caller's folder). The Profile tab uploader is removed.
5. **Display name from registration (DB).** Trigger on `applications` insert/update of name columns sets `profiles.full_name` to `coalesce(preferred_name, first_name) || ' ' || last_name`, but only while the profile name is empty, a sign-up default (Google name or email prefix), or the application name it copied before. A name changed on the Profile tab is kept. No backfill: existing accounts pick it up the next time their application name is saved. The migration needs sign-off before it is applied.
6. **Review step.** New "Review" step between "The event" and "Submit": photo plus every answer read-only (reusing the dashboard application view, plus demographics), each group with an Edit link to its step.

## Approaches considered

- Photo upload as its own step: rejected, one optional field doesn't earn a click for everyone.
- Writing a default image URL into every profile: rejected, render-time fallback covers old and new accounts with no data change.
- Syncing the name in app code (`saveDraft`/`submitApplication`): rejected in favour of a DB trigger that catches every write path.
- Review inside the Submit step: rejected, buries the agreements under a long page.

## Left to the builder

Exact icon artwork (lucide `UserRound`), copy, and styling within the existing apply/dashboard look.
