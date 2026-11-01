import type { PathChapter, PathLayer } from "@/components/path/types";

const TRAILHEAD_LAYERS: PathLayer[] = [
  { id: "trailhead-sky", slot: "sky", depth: 0.06, speed: 0.08, order: 1, src: "/path/ch1/01-sky.svg", alt: "" },
  { id: "trailhead-hills", slot: "far", depth: 0.2, speed: 0.34, order: 2, src: "/path/ch1/02-hills.svg", alt: "" },
  { id: "trailhead-path", slot: "mid", depth: 0.48, speed: 1.45, order: 3, src: "/path/ch1/03-path.svg", alt: "" },
  { id: "trailhead-mist", slot: "mid", depth: 0.36, speed: 0.62, order: 4, src: "/path/ch1/04-mist.svg", alt: "" },
  {
    id: "trailhead-mid-flowers",
    slot: "near",
    depth: 0.7,
    speed: 2.25,
    order: 5,
    src: "/path/ch1/05-mid-flowers.svg",
    alt: "",
    inline: true,
  },
  {
    id: "trailhead-near-flowers",
    slot: "near",
    depth: 0.84,
    speed: 3.15,
    order: 6,
    src: "/path/ch1/06-near-flowers.svg",
    alt: "",
    mobile: false,
  },
  {
    id: "trailhead-foreground",
    slot: "foreground",
    depth: 0.98,
    speed: 4.1,
    order: 7,
    src: "/path/ch1/07-foreground-stems.svg",
    alt: "",
    mobile: false,
  },
];

function layersFor(id: string, foregroundOnMobile: boolean): PathLayer[] {
  return [
    {
      id: `${id}-sky`,
      slot: "sky",
      depth: 0.06,
      alt: "",
      placeholder: `${id}-sky`,
    },
    {
      id: `${id}-far`,
      slot: "far",
      depth: 0.22,
      alt: "",
      placeholder: `${id}-far`,
    },
    {
      id: `${id}-mid`,
      slot: "mid",
      depth: 0.48,
      alt: "",
      placeholder: `${id}-mid`,
    },
    {
      id: `${id}-near`,
      slot: "near",
      depth: 0.74,
      alt: "",
      placeholder: `${id}-near`,
    },
    {
      id: `${id}-foreground`,
      slot: "foreground",
      depth: 0.98,
      alt: "",
      placeholder: `${id}-foreground`,
      mobile: foregroundOnMobile,
    },
  ];
}

/**
 * Walk the path. Swap any layer's `src` for Jiwoo's SVG, PNG, or WebP
 * (for example `/path/trailhead-sky.webp`). Omit `src` to keep the placeholder.
 * See the README section "Walk the path".
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
    light: "#ffd98a",
    anchor: "about",
    layers: layersFor("clearing", false),
  },
  {
    id: "fork",
    title: "Fork",
    light: "#f6c56e",
    anchor: "tracks",
    layers: layersFor("fork", false),
  },
  {
    id: "oak",
    title: "Old oak",
    light: "#f0a84a",
    align: "end",
    layers: layersFor("oak", false),
  },
  {
    id: "stream",
    title: "Stream",
    light: "#e8884a",
    align: "bottom",
    layers: layersFor("stream", false),
  },
  {
    id: "fence",
    title: "Fence",
    light: "#e06a3c",
    layers: layersFor("fence", false),
  },
  {
    id: "hive",
    title: "Hive",
    light: "#d24a32",
    anchor: "apply",
    layers: layersFor("hive", true),
  },
];

export const FINAL_WASH = "#8a2a22";
