// Content for the homepage About section (src/components/sections/about).
// Images are built by scripts/about-assets.mjs into public/about/.

export type AboutImage = {
  /** Path without the width and extension: "/about/attendees" -> attendees-1600.avif etc. */
  base: string;
  /** Widths built by the asset script, largest first. */
  widths: readonly number[];
  /** Tiny grayscale copy the ASCII renderer samples. */
  ascii: string;
  alt: string;
};

export type AboutStat = {
  id: string;
  value: number;
  label: string;
  image: AboutImage;
  /** True while the number is a stand-in. */
  placeholder: boolean;
};

export type AboutProject = {
  id: string;
  name: string;
  place: string;
  team: string;
  /** YouTube video id of the demo. */
  youtubeId: string;
  image: AboutImage;
  placeholder: boolean;
};

export const ABOUT_INTRO = [
  "Ontario Tech’s very own hackathon, the largest in the Durham Region. A weekend to build with people from here and far beyond.",
] as const;

// PLACEHOLDER NUMBERS: swap in the real 2026 counts.
export const ABOUT_STATS: readonly AboutStat[] = [
  {
    id: "attendees",
    value: 300,
    label: "attendees",
    placeholder: true,
    image: {
      base: "/about/attendees",
      widths: [1600, 800],
      ascii: "/about/attendees-ascii.png",
      alt: "Hackers in a lecture hall listening to the opening talk at HackHive 2026.",
    },
  },
  {
    id: "applicants",
    value: 1200,
    label: "people applied for a seat",
    placeholder: true,
    image: {
      base: "/about/applicants",
      widths: [1600, 800],
      ascii: "/about/applicants-ascii.png",
      alt: "Two HackHive organizers presenting the judging rules at the front of the room.",
    },
  },
  {
    id: "projects",
    value: 55,
    label: "projects demoed to the judges",
    placeholder: false,
    image: {
      base: "/about/projects",
      widths: [800],
      ascii: "/about/projects-ascii.png",
      alt: "Two hackers giving a thumbs up beside their hardware demo.",
    },
  },
];

// PLACEHOLDER PROJECTS: names, teams and video ids are stand-ins until the 2026 winners are filled in.
// They all share one photo (public/about/project-*) for now.
const PROJECT_PHOTO: AboutImage = {
  base: "/about/project",
  widths: [800],
  ascii: "/about/project-ascii.png",
  alt: "Two hackers giving a thumbs up beside their hardware demo.",
};

export const ABOUT_PROJECTS: readonly AboutProject[] = [
  {
    id: "first",
    name: "Project One",
    place: "1st place",
    team: "Team Placeholder A",
    youtubeId: "dQw4w9WgXcQ",
    image: PROJECT_PHOTO,
    placeholder: true,
  },
  {
    id: "second",
    name: "Project Two",
    place: "2nd place",
    team: "Team Placeholder B",
    youtubeId: "dQw4w9WgXcQ",
    image: PROJECT_PHOTO,
    placeholder: true,
  },
  {
    id: "third",
    name: "Project Three",
    place: "3rd place",
    team: "Team Placeholder C",
    youtubeId: "dQw4w9WgXcQ",
    image: PROJECT_PHOTO,
    placeholder: true,
  },
];

/** Where "See all 2026 projects" goes. The page does not exist yet, so the link shows as coming soon. */
export const PROJECTS_PAGE = { href: "/projects", ready: false } as const;

export function srcSet(image: AboutImage, ext: "avif" | "webp") {
  return image.widths.map((w) => `${image.base}-${w}.${ext} ${w}w`).join(", ");
}

export function fallbackSrc(image: AboutImage) {
  return `${image.base}-${image.widths[image.widths.length - 1]}.webp`;
}
