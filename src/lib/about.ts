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
  /** YouTube video id of the demo. */
  youtubeId: string;
  devpost: string;
  /** The code, when the team has shared it. */
  github?: string;
  image: AboutImage;
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

// Projects from HackHive 2026. Images are built by scripts/about-assets.mjs.
const projectImage = (name: string, widths: readonly number[], alt: string): AboutImage => ({
  base: `/about/${name}`,
  widths,
  ascii: `/about/${name}-ascii.png`,
  alt,
});

export const ABOUT_PROJECTS: readonly AboutProject[] = [
  {
    id: "neurodetect",
    name: "NeuroDetect",
    youtubeId: "TcK3JO73CKs",
    devpost: "https://devpost.com/software/neurodetect-rst574",
    image: projectImage("neurodetect", [800], "Two NeuroDetect team members working at their laptops."),
  },
  {
    id: "lockblock",
    name: "LockBlock",
    youtubeId: "1hwgS66tB9k",
    devpost: "https://devpost.com/software/lockblock-9ct281",
    image: projectImage("lockblock", [800], "The LockBlock team giving a thumbs up beside their hardware demo."),
  },
  {
    id: "cutos",
    name: "CutOS",
    youtubeId: "t0zHzwyXm_Q",
    devpost: "https://devpost.com/software/cutos",
    image: projectImage("cutos", [1600, 800], "The four members of the CutOS team smiling together."),
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
