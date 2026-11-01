import type { PathChapter, PathLayer } from "@/components/path/types";

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
    layers: layersFor("trailhead", false),
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
