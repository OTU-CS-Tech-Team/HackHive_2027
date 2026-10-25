# HackHive_2027
HackHive 2027 website

## Find a team

Open **Looking for group** in the hacker hub, or visit `/dashboard/team`.
The previous `/dashboard?tab=team` link redirects here. Accepted hackers and
admins can browse; individual profiles appear only while their owners opt in.
Directory queries and client props exclude email addresses. The app uses the
signed-in user's access and row-level security, without a service-role key.

### Discovery and profiles

Hackers can share skills, roles, interests, a project idea, experience, and goals
at `/dashboard/team/profile`, with a live card preview. Search and shareable URL
filters cover the full authorized directory, including records beyond the API
row limit. Suggested results explain actual shared interests or complementary
roles. Nine cards load initially, with **Meet more hackers** on mobile and desktop.

**Saved** profiles and **I reached out** markers are private to their owner.
Introductions are editable and copied only on request; the site never sends
messages automatically. Provided Slack and social links open in another tab.
Unsafe URLs are suppressed. Slack member links require access to the member's
workspace. Hackers can hide their listing, confirm they are still looking, or
mark that they found a team. Joining a recruiting team automatically hides the
individual listing; leaving never relists someone without their choice.

### Team recruitment

Hackers can publish a team with a project pitch, open roles, interests, goals,
and capacity of two to four people including the owner. Join requests are private
to the applicant and owner. Owners can accept or decline requests, edit recruitment,
or disband the team. Members can leave, and applicants can withdraw requests.
Database constraints and row locks enforce capacity and one team per hacker.
These discovery rosters do not change registration applications or submissions.

### Deployment and checks

Apply these migrations to the shared Supabase project before deploying:

- `supabase/migrations/20261023003437_teammate_slack_profile.sql`
- `supabase/migrations/20261024231211_teammate_discovery_and_recruiting.sql`

The second migration adds rich profile fields, private bookmarks, recruiting teams,
rosters, join requests, scoped policies, and atomic recruitment functions. Existing
opted-in profiles continue to work. If the new profile columns are absent, the
page falls back to basic discovery and listing controls until the migration is applied.
For the Supabase SQL editor, copy the entire migration: it is one atomic `DO`
statement that creates its private schema and tables before their dependents.
No separate schema bootstrap is required. A failed run rolls back its changes.
For troubleshooting, `supabase/diagnostics/teammate_migration_state.sql` reports
schema objects without reading hacker data.

### Preview fixtures and visual controls

`npm run team:seed` creates 12 discoverable fictional hackers and three recruiting
teams on the project configured in `.env` (16 accounts including owners and one
approved member). Names include `(TEST)`, introductions identify fictional data,
emails use `example.test`, and profile links use `example.com`. No emails are sent.
Existing demo teams and their requests/memberships are preserved when rerunning.
The script requires the service-role key locally; the app never receives that key.
Run `npm run team:seed:clean` to remove only accounts with this fixture's protected
metadata marker and matching test email pattern, plus their cascading data.

The teammate page uses styled Radix selects for keyboard navigation and consistent
menus, including inside dialogs. Its Three.js honeycomb and bee are loaded on the
client. The animation has a pause control, honors reduced motion, stops offscreen
or in a hidden tab, caps rendering resolution/frame rate, and frees GPU resources
when leaving the page. A static honeycomb remains when WebGL is unavailable.

Run `npm test`, `npm run lint`, and `npm run build`. Team tests cover safe client
projections, 1,013-row loading, validation, matching, and real isolated PostgreSQL
RLS/recruitment flows using PGlite. They do not require a shared database.

## Detailed admin stats

Open **Detailed stats** from `/admin`, or visit `/admin/stats`. The page uses the
existing admin membership, application table, and admission decisions. It requires
no database migration or service-role key.

The overview shows submitted applications, approved applicants, pending reviews,
waitlists, rejections, drafts, and submissions in the last seven days. **Approved**
uses the existing `accepted` decision; it does not mean attendance is confirmed.
Community and logistics breakdowns cover submitted applications only: schools,
team preferences, first-time hackers, T-shirt sizes, and support responses. These
include all admission outcomes and are planning estimates, not confirmed orders.
Dietary/accessibility counts include nonblank responses, which may say “none.”

Use the Admissions, Community, and Logistics views to see one focused report at
a time. School breakdowns show the top five plus a combined remainder. These
compact views avoid a long stack of charts, including on phones.

Use **Refresh stats** for current numbers. **Review applications** returns to the
existing admin application controls. Application and decision editing continue
to work as before.

## HackHive Museum

Select **Visit the HackHive Museum** in the homepage's past-HackHive section, or
open `/hackhive/archive`. The route is defined by
`src/app/hackhive/archive/page.tsx`, which imports the museum component and archive
data. A sticky year menu lets visitors jump straight to any collection on mobile
and desktop. The museum includes
all 21 projects from 2026, 2025, and 2024, click-to-play videos, project thumbnails,
and the scroll-driven puzzle navigation.

### Shared content, independent design

The source of truth for projects and archive years is
[`src/data/hackhive.ts` in the CS Club repository](https://github.com/OTU-CS-Tech-Team/CS_Club_Website-2027/blob/main/src/data/hackhive.ts).
Edit project content there. HackHive automatically refreshes the data and project
thumbnails when `npm run dev` or `npm run build` starts. Run `npm run museum:sync`
to refresh an already-running local server. Published content updates with the
next HackHive build/deployment; this is not a live API connection.

The sync script resolves CS Club's latest `main` commit, reads the literal
`ARCHIVE_YEARS` and `hackhiveProjects` exports, validates the content, and downloads
thumbnails from that same commit. It never executes upstream code. Source data
must remain literal arrays/objects. Network failures or invalid content stop
the build rather than silently publishing stale data.

`src/data/generated/hackhive.json` and `public/museum/projects/` are generated and
gitignored. The JSON records its source commit. Do not edit generated files.
`src/data/hackhive.ts` groups the generated projects into local archive collections.
HackHive's components, CSS, puzzle animation, year menu, and homepage section live
in this repository. CS Club's presentation fields (rotation, pins, annotations)
are excluded from the shared content.

Run `npm ci`, then `npm run dev` to preview locally. Internet access to the public
CS Club GitHub repository is required during sync. Validate with `npm run lint`,
`npm run build`, and `npm test -- tests/museum-sync.test.ts`. When running TypeScript
directly after a fresh checkout, run `npm run museum:sync` first.
