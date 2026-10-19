# HackHive_2027
HackHive 2027 website

## HackHive Museum

Select **Visit the HackHive Museum** in the homepage's past-HackHive section, or
open `/hackhive/archive`. The route is defined by
`src/app/hackhive/archive/page.tsx`, which imports the museum component and archive
data. A sticky year menu lets visitors jump straight to any collection on mobile
and desktop. The museum includes
all 21 projects from 2026, 2025, and 2024, click-to-play videos, project thumbnails,
and the scroll-driven puzzle navigation.

Copied from `OTU-CS-Tech-Team/CS_Club_Website-2027` at commit
`74e465cf249b96de4ba5d5e2fc0db72d8d2e2a37`. Museum components live in
`src/components/museum`, project data in `src/data/hackhive.ts`, and thumbnails in
`public/projects`.

Run `npm ci`, then `npm run dev` to preview locally. Validate with `npm run lint`
and `npm run build`.
