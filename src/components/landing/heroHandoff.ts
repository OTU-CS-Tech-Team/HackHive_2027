// Scroll progress is 0 at the top of the hero and 1 when the sticky stage
// releases. The camera walks only the first WALK_END of the scene's path:
// past about 0.25 the near garden slides under the frame and the meadow
// reads as bare hills, so the walk stops while the beds still fill it.
//
// The hero sits above Sponsors and overlaps it by exactly the height of
// Sponsors' .dawn (white into cream into gold), so that strip never shows.
// The stage's bottom edge lands where .dawn ends on #f5cc7c, the first
// colour of the Sponsors sky and hive wall. A gold band rises over the
// meadow's foot and reaches that colour, opaque, on the stage's last row.

export const TRACK = 1.45;
export const WALK_END = 0.2;
const COPY_FADE_START = 0.72;
const COPY_FADE_SPAN = 0.18;
const BAND_START = 0.55;
const BAND_SPAN = 0.45;

/** Sponsors' first gold, where its .dawn gradient ends. */
export const SPONSORS_GOLD = "#f5cc7c";

export function clamp01(value: number) {
  if (value <= 0) return 0;
  if (value >= 1) return 1;
  return value;
}

function smoothstep(value: number) {
  const t = clamp01(value);
  return t * t * (3 - 2 * t);
}

/** Walk the scene's progress forward, never past the full garden. */
export function sceneProgress(scroll: number) {
  return clamp01(scroll) * WALK_END;
}

// 0 while the title group is fully present, 1 once it has left.
export function copyFade(scroll: number) {
  return smoothstep((clamp01(scroll) - COPY_FADE_START) / COPY_FADE_SPAN);
}

export const COPY_LIFT_VH = 14;

/** 0 until BAND_START, exactly 1 at release. */
export function bandAmount(scroll: number) {
  return smoothstep((clamp01(scroll) - BAND_START) / BAND_SPAN);
}

// Any thin warm wash over a white petal reads as cream, so the band climbs
// out of the meadow quickly and in deep honey: a lily under it turns gold
// within a few rows instead of sitting in a pale peach strip. It then
// lightens to Sponsors' gold, opaque on the stage's last row. The band grows
// from the bottom as it strengthens.
export function veilBackground(scroll: number) {
  const t = bandAmount(scroll);
  if (t <= 0) return "transparent";
  const height = 10 + 12 * t;
  const top = 100 - height;
  const at = (share: number) => (top + height * share).toFixed(2);
  const a = (alpha: number) => (alpha * t).toFixed(3);
  return [
    "linear-gradient(to bottom,",
    "rgba(214,140,30,0) 0%,",
    `rgba(214,140,30,0) ${top.toFixed(2)}%,`,
    `rgba(214,140,30,${a(0.55)}) ${at(0.18)}%,`,
    `rgba(232,172,70,${a(0.88)}) ${at(0.6)}%,`,
    `rgba(245,204,124,${a(1)}) 100%)`,
  ].join(" ");
}
