import type { PathChapter, PathLayer } from "@/components/path/types";

const TRAILHEAD_LAYERS: PathLayer[] = [
  { id: "trailhead-sky", slot: "sky", depth: 0.06, speed: 0.08, order: 1, src: "/path/ch1/01-sky.webp", alt: "" },
  { id: "trailhead-hills", slot: "far", depth: 0.2, speed: 0.34, order: 2, src: "/path/ch1/02-hills.webp", alt: "" },
  { id: "trailhead-path", slot: "mid", depth: 0.48, speed: 1.45, order: 3, src: "/path/ch1/03-path.webp", alt: "" },
  { id: "trailhead-mist", slot: "mid", depth: 0.36, speed: 0.62, order: 4, src: "/path/ch1/04-mist.webp", alt: "" },
  {
    id: "trailhead-mid-flowers",
    slot: "near",
    depth: 0.7,
    speed: 2.25,
    order: 5,
    src: "/path/ch1/05-mid-flowers.webp",
    alt: "",
  },
  {
    id: "trailhead-near-flowers",
    slot: "near",
    depth: 0.84,
    speed: 3.15,
    order: 6,
    src: "/path/ch1/06-near-flowers.webp",
    alt: "",
    mobile: false,
  },
  {
    id: "trailhead-foreground",
    slot: "foreground",
    depth: 0.98,
    speed: 4.1,
    order: 7,
    src: "/path/ch1/07-foreground-stems.webp",
    alt: "",
    mobile: false,
  },
];

function painted(id: string, folder: string, foregroundOnMobile: boolean): PathLayer[] {
  return [
    {
      id: `${id}-sky`,
      slot: "sky",
      depth: 0.06,
      speed: 0.08,
      order: 1,
      src: `/path/${folder}/01-sky.webp`,
      alt: "",
    },
    {
      id: `${id}-far`,
      slot: "far",
      depth: 0.22,
      speed: 0.36,
      order: 2,
      src: `/path/${folder}/02-far.webp`,
      alt: "",
    },
    {
      id: `${id}-path`,
      slot: "mid",
      depth: 0.5,
      speed: 1.25,
      order: 3,
      src: `/path/${folder}/03-path.webp`,
      alt: "",
    },
    {
      id: `${id}-near`,
      slot: "foreground",
      depth: 0.9,
      speed: 2.4,
      order: 4,
      src: `/path/${folder}/04-near.webp`,
      alt: "",
      mobile: foregroundOnMobile,
    },
  ];
}

/**
 * Walk the path. Display plates are WebP so blur is already in the pixels.
 * The SVG sources stay in public/path for the paintings themselves.
 */
export const PATH_CHAPTERS: PathChapter[] = [
  {
    id: "trailhead",
    title: "Trailhead",
    light: "#ffe7a3",
    anchor: "trailhead",
    layers: TRAILHEAD_LAYERS,
  },
  {
    id: "clearing",
    title: "Clearing",
    light: "#ffd27a",
    anchor: "about",
    layers: painted("clearing", "ch2", false),
  },
  {
    id: "fork",
    title: "Fork",
    light: "#f6b85a",
    anchor: "tracks",
    layers: painted("fork", "ch3", false),
  },
  {
    id: "oak",
    title: "Old oak",
    light: "#ee8d3e",
    anchor: "schedule",
    align: "end",
    layers: painted("oak", "ch4", false),
  },
  {
    id: "stream",
    title: "FAQ",
    light: "#e36a32",
    anchor: "faq",
    align: "bottom",
    layers: painted("stream", "ch5", false),
  },
  {
    id: "fence",
    title: "Fence",
    light: "#d4522c",
    anchor: "sponsors",
    layers: painted("fence", "ch6", false),
  },
  {
    id: "hive",
    title: "Hive",
    light: "#d24a32",
    anchor: "apply",
    layers: painted("hive", "ch7", true),
  },
];

export const FINAL_WASH = "#8a2a22";
