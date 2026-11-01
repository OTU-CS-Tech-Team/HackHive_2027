export const LAYER_SLOTS = ["sky", "far", "mid", "near", "foreground"] as const;

export type LayerSlot = (typeof LAYER_SLOTS)[number];

export const CHAPTER_IDS = [
  "trailhead",
  "clearing",
  "fork",
  "oak",
  "stream",
  "fence",
  "hive",
] as const;

export type ChapterId = (typeof CHAPTER_IDS)[number];

export type ChapterAlign = "center" | "end" | "bottom";

/**
 * One painted plane in a chapter.
 * Jiwoo can drop in SVG, PNG, or WebP by setting `src`. The placeholder
 * stands in until then. Depth 0 sits on the horizon; depth 1 is at the camera.
 */
export type PathLayer = {
  id: string;
  slot: LayerSlot;
  depth: number;
  alt: string;
  src?: string;
  placeholder?: string;
  /** When false, the layer is omitted below the mobile breakpoint. */
  mobile?: boolean;
};

export type PathChapter = {
  id: ChapterId;
  title: string;
  /** Warming tint for this stop, morning through sunset. */
  light: string;
  /** Document anchor. Omit when an existing section already owns the id. */
  anchor?: string;
  align?: ChapterAlign;
  layers: PathLayer[];
};
