# HackHive_2027
HackHive 2027 website

## Reviewing applicants

Open **Review applicants** from `/admin`, or visit `/admin/applicants`. Pending
applicants are listed oldest first. Use the tabs to switch status, and search by
name, email or school. **View application** shows the full application and resume.

**Accept**, **Waitlist** and **Reject** save straight away and email the applicant
through Resend, so they ask for confirmation first. Only accepted applicants (and
admins) get the full `/dashboard`; the email to accepted applicants links to it.
**Move to pending** emails nobody. If an email fails the decision stays saved and
the page says so; use **Resend email** to try again.

Decision emails need `RESEND_API_KEY` and `RESEND_FROM_EMAIL` on the host, and resume
links need `SUPABASE_SERVICE_ROLE_KEY`. The dashboard link uses the address the admin
is signed in on, so review from the live site.

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
