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
  /** Shown after the number, e.g. "+" for "300+". */
  suffix?: string;
  label: string;
  image: AboutImage;
};

export type AboutProject = {
  id: string;
  name: string;
  /** One sentence on what it does, shown under the name when the Polaroid is opened. */
  description: string;
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

export const ABOUT_STATS: readonly AboutStat[] = [
  {
    id: "attendees",
    value: 300,
    suffix: "+",
    label: "attendees",
    image: {
      base: "/about/attendees",
      widths: [1600, 800],
      ascii: "/about/attendees-ascii.png",
      alt: "Hackers in a lecture hall listening to the opening talk at HackHive 2026.",
    },
  },
  {
    id: "applicants",
    value: 500,
    suffix: "+",
    label: "applicants",
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
    suffix: "+",
    label: "projects built over the weekend",
    image: {
      base: "/about/projects",
      widths: [1600, 800],
      ascii: "/about/projects-ascii.png",
      alt: "Two hackers working on a hardware build wired to a laptop at HackHive 2026.",
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
    description: "An educational prototype that uses a trained image model to classify brain MRI scans.",
    youtubeId: "TcK3JO73CKs",
    devpost: "https://devpost.com/software/neurodetect-rst574",
    github: "https://github.com/KrishnaKMA/hackathon-app",
    image: projectImage("neurodetect", [800], "Two NeuroDetect team members working at their laptops."),
  },
  {
    id: "lockblock",
    name: "LockBlock",
    description:
      "A smart door lock that recognizes faces, locks itself when it spots a stranger, and unlocks with a Solana wallet.",
    youtubeId: "1hwgS66tB9k",
    devpost: "https://devpost.com/software/lockblock-9ct281",
    github: "https://github.com/e-yang6/lockblock",
    image: projectImage("lockblock", [800], "The LockBlock team giving a thumbs up beside their hardware demo."),
  },
  {
    id: "cutos",
    name: "CutOS",
    description:
      "An AI video editor you drive in plain English, with search across your footage and dubbing into 29 languages.",
    youtubeId: "t0zHzwyXm_Q",
    devpost: "https://devpost.com/software/cutos",
    github: "https://github.com/shamsharoon/CutOS",
    image: projectImage("cutos", [1600, 800], "The four members of the CutOS team smiling together."),
  },
];

/** The HackHive museum: every year's projects. */
export const ARCHIVE_PAGE = "/hackhive/archive";

export function srcSet(image: AboutImage, ext: "avif" | "webp") {
  return image.widths.map((w) => `${image.base}-${w}.${ext} ${w}w`).join(", ");
}

export function fallbackSrc(image: AboutImage) {
  return `${image.base}-${image.widths[image.widths.length - 1]}.webp`;
}
