# HackHive_2027
HackHive 2027 website

## Find a team

Open **Looking for group** in the hacker hub or visit `/dashboard/team`.
The legacy `/dashboard?tab=team` URL redirects here. Accepted hackers and admins
can browse. Individual profiles appear only while their owners opt in; directory
projections exclude emails. The app uses the signed-in user's RLS permissions.

Profiles include skills, roles, interests, project ideas, experience, goals, and
a Slack member link. `/dashboard/team/profile` provides a focused editor and live
preview. Search and URL filters cover all authorized rows, including directories
larger than the API row limit. Suggested results explain complementary roles or
shared interests. Nine cards load initially, with a load-more control. Saved
profiles are private to their owner.

Hacker cards and recruiting posts link directly to **Message on Slack** in a new
tab. There are no on-site introductions, messages, join requests, or approvals.
A profile without a Slack link displays that information plainly. Listing a new
profile or publishing a team post requires a valid Slack member-profile URL.
Teams publish a project pitch, open roles, interests, goal, team-size limit, and
an explicit Slack contact. Owners edit or close their posts after forming a team
on Slack. Team posts do not alter registration submissions. Existing roster data
is retained, and existing members can leave their legacy roster if needed.

### Deployment and verification

Apply these migrations before deploying:

- `supabase/migrations/20261023003437_teammate_slack_profile.sql`
- `supabase/migrations/20261024231211_teammate_discovery_and_recruiting.sql`
- `supabase/migrations/20261025011816_teammate_slack_contact.sql`

The last migration adds a separately published team Slack contact and revokes
legacy join-request writes and approvals. Historical records are preserved.
The larger discovery migration is one atomic `DO` statement; copy the whole file
when using the SQL editor. `supabase/diagnostics/teammate_migration_state.sql`
reports schema objects without reading hacker data. Missing new contact columns
fall back to readable posts with editing disabled until the migration is applied.

Run `npm test`, `npm run lint`, and `npm run build`. Tests cover safe projections,
1,013-row loading, matching, URL validation, RLS, SQL rollback, and retirement of
request writes in isolated PostgreSQL using PGlite.

### Preview fixtures and motion

`npm run team:seed` creates 12 fictional discoverable hackers and three recruiting
posts on the project configured in `.env`. Names include `(TEST)`, bios identify
fictional data, and emails use `example.test`. Slack links are fictional member
placeholders in `hackhive-demo.slack.com`; other links use `example.com`. No signup
emails or messages are sent. The script requires a local service-role key, which
is never passed to the browser. Existing posts and legacy data are preserved on
reruns. `npm run team:seed:clean` removes only accounts with the fixture's protected
metadata marker and matching test email pattern, plus their cascading data.

Cards use an aligned grid, warm neutral surfaces, dark text, and amber outlines.
Styled Radix selects support keyboards and work inside dialogs. A Three.js
honeycomb assembles on entry, then the bee, wings, and honeycomb keep moving while
visible. There is no play/pause control. Reduced motion renders a
static scene; hidden/offscreen animation is suspended. GPU resources are released
when navigating away, and a static fallback works without WebGL. Card entrances,
menu transitions, and hover feedback also honor reduced motion.

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
