# HackHive_2027
HackHive 2027 website

## Find a team

Open **Looking for group** in the hacker hub, or visit `/dashboard/team`.
The page reuses the existing `has_hub_access()` and profile row-level security
rules: accepted hackers and admins can browse, and profiles appear only when
their owners opt into `looking_for_team`. Your own card appears separately.
No service-role key is required. Before deploying, apply
`supabase/migrations/20261023003437_teammate_slack_profile.sql`, which adds one
optional `profiles.slack_url` field without changing existing data or access rules.

Hackers can make their listing discoverable or hide it directly on the page,
search by name/school, filter by school or GitHub presence, and browse paginated
contact cards (one per page on mobile, three on desktop). School and search filters apply to the full authorized directory,
including records beyond the API row limit. **Connect on Slack** is the primary
CTA when a Slack profile is provided. **View GitHub** and **Connect on LinkedIn**
offer additional connection options. These links open the hacker's provided
profile in a new tab. Hackers can add an optional Slack member
profile link under **Pass & profile**. Slack links require access to that member's
workspace ([Slack's member-profile link instructions](https://slack.com/help/articles/360003827751-Create-a-link-to-a-members-profile)). Only available connection links are shown, and invalid or unsafe links
are suppressed.
Team tips and listing privacy details are collapsible. All action buttons use
consistent touch targets, keyboard focus, hover, and disabled styles.
The directory includes loading, empty, no-match, and error states, plus manual
refresh. Profile and avatar updates refresh the new page too.

These are teammate-discovery profiles, not registered teams or invitations.
Once hackers form a team, they can hide their listings. Skills/interests, team
recruitment posts with open roles, and invitation/acceptance workflows would need
additional data models and are possible follow-ups. The previous
`/dashboard?tab=team` view remains available.

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
