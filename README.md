# HackHive_2027
HackHive 2027 website

## Reviewing applicants

Open **Review applicants** from `/admin`, or visit `/admin/applicants`. Pending
applicants are listed oldest first. Use the tabs to switch status, and search by
name, email or school. **View application** shows the full application and resume.

**Accept**, **Waitlist** and **Reject** only *stage* a decision ("Staged: Accept ·
not sent yet", with **Undo**); nobody is emailed. Staged decisions go out together
when an admin releases a wave on `/admin/decisions`: the decisions are saved, the
emails go out through Resend in batches, and rejections are held back until the
final wave. Only accepted applicants (and admins) get the full `/dashboard`; the
email to accepted applicants links to it. If an email fails, the wave history shows
it; use **Retry** there. **Resend email** on an applicant only works once their wave
email has gone (otherwise it would email them twice).

Blind review (`/admin/review`) only votes and places people in pools. Its
outcomes are staged from `/admin/decisions` with **From blind review → Stage** (anyone already staged by hand keeps what they have). The
Decisions page's seat trackers use the blind review seat targets
(`review_settings`) and count released, staged and review-accepted people the same
way blind review does, so accepting by hand uses up seats too. Anyone with a staged
decision is out of the review queue. The page can also stage accepts for the top of
the waitlist: blind review's waitlist order first, then Hive Mind rank.

Migrations, in order: `20261121000000_blind_review.sql`,
`20261122000000_release_waves.sql`, `20261123000000_review_decisions.sql`,
`20261124000000_staged_clock_and_votes.sql`.

**Delete** permanently removes someone's account, application, profile, points,
team posts and uploaded files, after you type `DELETE` to confirm. It can't be
undone, and admin accounts are refused. Accounts with no application don't appear
here, so remove those in Supabase.

Decision emails need `RESEND_API_KEY`, `RESEND_FROM_EMAIL` and `NEXT_PUBLIC_SITE_URL`
(the live site's origin; the accepted email's dashboard link is built
from it) on the host, and resume links need `SUPABASE_SERVICE_ROLE_KEY`. See
`.env.example` for the full list.

## Schedule deployment

Apply the schedule migrations before deploying PR #15:

- `supabase/migrations/20261023000000_event_categories.sql`
- `supabase/migrations/20261025000000_schedule_colours.sql`
- `supabase/migrations/20261026062455_schedule_category_compatibility.sql`

If the first two are already applied, run only the compatibility migration.
Copy its entire file into the SQL editor; it is one atomic statement. It keeps
old enum-only admin forms and new category-ID forms working together. Existing
open schedules still receive a valid enum; custom categories display as general
HackHive events on old clients and retain their exact name/colour on new clients.
The trigger runs with the caller's permissions and preserves the admin-only RLS.

The schedule lists overnight events on every Toronto date they overlap, clips
each day's placement at midnight, and shows the full date range in event details.
Tests cover exact-midnight endings, DST boundaries, and old/new database writes.

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
hexagonal hive renders at 2–3x resolution. One randomly chosen cell fills from
the bottom, clears, and passes to a different cell; there are no bees or drips.
There is no play/pause control. Reduced motion renders a
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

## Bee avatar

Accepted hackers build a bee on `/dashboard/avatar` (tap the square under the
logo on the passport): a top, bottom, shoes, hat, headphones, glasses and LED
face, each in a colour. The bee is SVG drawn in code
(`src/app/dashboard/avatar/Bee.tsx`), so every piece mixes with every other; the
pieces and colours are listed in `src/lib/avatar.ts`. The wardrobe shows the same
bee in 3D (`src/app/dashboard/avatar/Bee3D.tsx`, three.js), which you can drag to
turn; a new piece needs drawing in both files. Without WebGL the wardrobe shows
the SVG bee. The passport shows just the head: in 3D (`BeeHead` in `Bee3D.tsx`),
turning to look at the cursor when it comes near (out to the Hacker Profile
box), or flat on touch screens, with reduced motion, and without WebGL.

Applicants can also build their bee, and name it, in the application form's
optional "Your bee" step (just before Review). It saves straight to their
profile as they go, not to the draft, and a failed save never blocks submitting;
once they're accepted it's the bee on their passport and in the wardrobe. The
name is optional (24 characters at most), is stored with the bee in
`profiles.avatar`, and is the Build your bee page's title, where it can be
changed. Applicants who submitted before this step existed build theirs after
they're accepted. There's no new migration.

Apply `supabase/migrations/20261126120000_avatar.sql` before deploying. Until it
is applied, passports show the default bee, the wardrobe page says it couldn't
load, and nothing else breaks. A retired piece in a saved avatar shows the
default piece instead.

## HackHive Museum

Select **Visit the HackHive Museum** in the homepage's past-HackHive section, or
open `/hackhive/archive`. The route is defined by
`src/app/hackhive/archive/page.tsx`, which imports the museum component and archive
data. Each year is a constellation on a black star field. The Museum keeps the
site navigation, honey-amber accents, warm text, and restrained typography. A clockwise tour highlights
project stars and updates the featured thumbnail and demo player. Choose any
star, use previous/next, or pause the tour. Playing a demo holds the selection;
leaving the year, hiding the tab, or navigating away removes the player.

The first project and its polygon constellation appear immediately. The stylized zodiac figures are Cancer (2026), Taurus (2025), and Capricornus
(2024), with branching claws, horns, and a sea-goat tail. The lines stay unfilled
so the projects remain prominent. Additional projects subdivide existing lines
to preserve the silhouette. These are illustrative layouts, not sky coordinates. A black canvas sky
opens with a brief flight through distant stars, then continues a visible forward flight with depth-scaled star streaks.
Scrolling briefly accelerates the flight. It pauses when the tab is hidden and renders a still sky for reduced motion.
There is no comet or moving pointer on the constellations. The year marker writes
each year, then scribbles over and replaces it in one slot. Year links stay fixed
at the bottom for direct navigation. Existing project controls and video cleanup
remain in place.

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
HackHive's components, CSS, constellation animation, year menu, and homepage section live
in this repository. CS Club's presentation fields (rotation, pins, annotations)
are excluded from the shared content.

Run `npm ci`, then `npm run dev` to preview locally. Internet access to the public
CS Club GitHub repository is required during sync. Validate with `npm run lint`,
`npm run build`, and `npm test -- tests/museum-sync.test.ts`. When running TypeScript
directly after a fresh checkout, run `npm run museum:sync` first.
